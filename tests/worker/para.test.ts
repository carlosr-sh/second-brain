import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Area, Goal, Project, Task, TaskUpdateResult, TrashItem } from "../../src/shared/para";
import type { InboxItem } from "../../src/shared/inbox";
import { createFakeAccess } from "../helpers/access";
import { makeApi, makeClient } from "../helpers/app";

let api: ReturnType<typeof makeApi>;

beforeAll(async () => {
  const fake = await createFakeAccess();
  api = makeApi(makeClient(fake.keyResolver), await fake.sign());
});

beforeEach(async () => {
  for (const t of ["tasks", "projects", "goals", "areas", "inbox_items", "audit_logs"]) await env.DB.prepare(`delete from ${t}`).run();
});

const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("areas, goals, projects", () => {
  it("CRUD with derived stats and goal progress", async () => {
    const area = await api.ok<Area>("POST", "/api/areas", { name: "Saúde", color: "#22aa88" });
    const goal = await api.ok<Goal>("POST", "/api/goals", { title: "Correr 10 km", areaId: area.id, horizon: "year", targetDate: "2026-12-31" });
    const p1 = await api.ok<Project>("POST", "/api/projects", { name: "Plano de treino", areaId: area.id, goalId: goal.id, status: "active" });
    await api.ok<Project>("POST", "/api/projects", { name: "Exames", areaId: area.id, goalId: goal.id, status: "completed" });
    await api.ok<Task>("POST", "/api/tasks", { title: "Comprar tênis", projectId: p1.id });

    const [areaRow] = await api.ok<Area[]>("GET", "/api/areas");
    expect(areaRow?.stats).toEqual({ activeProjects: 1, openTasks: 1 });
    expect((await api.ok<Goal>("GET", `/api/goals/${goal.id}`)).progress).toEqual({ completed: 1, total: 2 });
    expect((await api.ok<Project>("GET", `/api/projects/${p1.id}`)).taskStats).toEqual({ open: 1, done: 0 });

    const done = await api.ok<Project>("PATCH", `/api/projects/${p1.id}`, { status: "completed" });
    expect(done.completedAt).not.toBeNull();
    const reopened = await api.ok<Project>("PATCH", `/api/projects/${p1.id}`, { status: "active" });
    expect(reopened.completedAt).toBeNull();
  });

  it("validates input and references", async () => {
    expect((await api.req("POST", "/api/areas", { name: "  " })).status).toBe(400);
    expect((await api.req("POST", "/api/projects", { name: "x", dueDate: "2026-02-30" })).status).toBe(400);
    const missing = await api.req("POST", "/api/projects", { name: "x", areaId: "0190a0a0-0000-7000-8000-000000000099" });
    expect(missing.status).toBe(404);
    expect((await api.req("PATCH", "/api/areas/0190a0a0-0000-7000-8000-000000000099", { name: "y" })).status).toBe(404);
    const area = await api.ok<Area>("POST", "/api/areas", { name: "A" });
    expect((await api.req("PATCH", `/api/areas/${area.id}`, {})).status).toBe(400); // empty patch
  });

  it("archiving a project cascades to its tasks and unarchiving restores exactly them", async () => {
    const project = await api.ok<Project>("POST", "/api/projects", { name: "Mudança" });
    const t1 = await api.ok<Task>("POST", "/api/tasks", { title: "Caixas", projectId: project.id });
    const t2 = await api.ok<Task>("POST", "/api/tasks", { title: "Já arquivada", projectId: project.id });
    await api.ok("PATCH", `/api/tasks/${t2.id}`, { archived: true });

    await api.ok("PATCH", `/api/projects/${project.id}`, { archived: true });
    expect(await api.ok<Project[]>("GET", "/api/projects")).toHaveLength(0);
    expect((await api.ok<Project[]>("GET", "/api/projects?archived=true")).map((p) => p.id)).toEqual([project.id]);
    expect(await api.ok<Task[]>("GET", `/api/tasks?projectId=${project.id}`)).toHaveLength(0);

    // A task can't be unarchived while its project is archived.
    expect(await code(await api.req("PATCH", `/api/tasks/${t1.id}`, { archived: false }))).toBe("CONFLICT");

    await api.ok("PATCH", `/api/projects/${project.id}`, { archived: false });
    const active = await api.ok<Task[]>("GET", `/api/tasks?projectId=${project.id}`);
    expect(active.map((t) => t.id)).toEqual([t1.id]); // t2 was archived before → stays archived
  });
});

describe("tasks", () => {
  it("enforces the single PARA location and auto-clears the other side", async () => {
    const area = await api.ok<Area>("POST", "/api/areas", { name: "Casa" });
    const project = await api.ok<Project>("POST", "/api/projects", { name: "Reforma" });
    expect((await api.req("POST", "/api/tasks", { title: "x", areaId: area.id, projectId: project.id })).status).toBe(400);

    const task = await api.ok<Task>("POST", "/api/tasks", { title: "Pintar", areaId: area.id });
    const moved = await api.ok<TaskUpdateResult>("PATCH", `/api/tasks/${task.id}`, { projectId: project.id });
    expect(moved.task).toMatchObject({ projectId: project.id, areaId: null });

    // Area filter includes tasks of the area's projects.
    await api.ok("PATCH", `/api/projects/${project.id}`, { areaId: area.id });
    expect((await api.ok<Task[]>("GET", `/api/tasks?areaId=${area.id}`)).map((t) => t.id)).toEqual([task.id]);
  });

  it("subtasks inherit location, are one level deep and follow the parent", async () => {
    const p1 = await api.ok<Project>("POST", "/api/projects", { name: "P1" });
    const p2 = await api.ok<Project>("POST", "/api/projects", { name: "P2" });
    const parent = await api.ok<Task>("POST", "/api/tasks", { title: "Pai", projectId: p1.id });
    const child = await api.ok<Task>("POST", "/api/tasks", { title: "Filha", parentTaskId: parent.id });
    expect(child.projectId).toBe(p1.id);

    expect(await code(await api.req("POST", "/api/tasks", { title: "Neta", parentTaskId: child.id }))).toBe("CONFLICT");
    const other = await api.ok<Task>("POST", "/api/tasks", { title: "Outra" });
    expect(await code(await api.req("PATCH", `/api/tasks/${parent.id}`, { parentTaskId: other.id }))).toBe("CONFLICT");
    expect(await code(await api.req("PATCH", `/api/tasks/${parent.id}`, { parentTaskId: parent.id }))).toBe("CONFLICT");

    await api.ok("PATCH", `/api/tasks/${parent.id}`, { projectId: p2.id });
    expect((await api.ok<Task>("GET", `/api/tasks/${child.id}`)).projectId).toBe(p2.id);
  });

  it("completing a recurring task keeps history and spawns the next occurrence atomically", async () => {
    const task = await api.ok<Task>("POST", "/api/tasks", {
      title: "Pagar aluguel", dueDate: "2026-01-31", recurrenceRule: "freq=monthly", priority: "high",
    });
    expect(task.recurrenceRule).toBe("FREQ=MONTHLY"); // canonicalized

    const { task: done, spawned } = await api.ok<TaskUpdateResult>("PATCH", `/api/tasks/${task.id}`, { status: "done" });
    expect(done).toMatchObject({ status: "done", recurrenceRule: null });
    expect(done.completedAt).not.toBeNull();
    expect(spawned).toMatchObject({ title: "Pagar aluguel", dueDate: "2026-02-28", status: "todo", priority: "high", recurrenceRule: "FREQ=MONTHLY" });

    // Reopening and completing again must NOT spawn a duplicate.
    await api.ok("PATCH", `/api/tasks/${task.id}`, { status: "todo" });
    const again = await api.ok<TaskUpdateResult>("PATCH", `/api/tasks/${task.id}`, { status: "done" });
    expect(again.spawned).toBeNull();
    expect(await api.ok<Task[]>("GET", "/api/tasks?status=todo")).toHaveLength(1);
  });

  it("filters by status and due-date range", async () => {
    await api.ok("POST", "/api/tasks", { title: "Ontem", dueDate: "2026-11-24" });
    await api.ok("POST", "/api/tasks", { title: "Hoje", dueDate: "2026-11-25" });
    await api.ok("POST", "/api/tasks", { title: "Sem data" });
    const done = await api.ok<Task>("POST", "/api/tasks", { title: "Feita", dueDate: "2026-11-25", status: "done" });
    expect(done.completedAt).not.toBeNull();

    const today = await api.ok<Task[]>("GET", "/api/tasks?dueFrom=2026-11-25&dueTo=2026-11-25&status=todo,in_progress,waiting");
    expect(today.map((t) => t.title)).toEqual(["Hoje"]);
    expect((await api.ok<Task[]>("GET", "/api/tasks?dueTo=2026-11-24")).map((t) => t.title)).toEqual(["Ontem"]);
    expect((await api.req("GET", "/api/tasks?status=bogus")).status).toBe(400);
  });

  it("reorders via position (kanban drag & drop)", async () => {
    const a = await api.ok<Task>("POST", "/api/tasks", { title: "A" });
    const b = await api.ok<Task>("POST", "/api/tasks", { title: "B" });
    await api.ok("PATCH", `/api/tasks/${b.id}`, { position: a.position - 0.5, status: "in_progress" });
    const all = await api.ok<Task[]>("GET", "/api/tasks");
    expect(all.map((t) => t.title)).toEqual(["B", "A"]);
    expect((await api.req("PATCH", `/api/tasks/${a.id}`, { position: "x" })).status).toBe(400);
  });
});

describe("inbox → task", () => {
  it("converts atomically and refuses double processing", async () => {
    const item = await api.ok<InboxItem>("POST", "/api/inbox", { content: "Ligar para o dentista" });
    const task = await api.ok<Task>("POST", `/api/inbox/${item.id}/convert-to-task`, { title: "Ligar para o dentista", dueDate: "2026-11-26" });
    expect(task.dueDate).toBe("2026-11-26");
    expect(await api.ok<InboxItem[]>("GET", "/api/inbox?status=open")).toHaveLength(0);
    expect(await code(await api.req("POST", `/api/inbox/${item.id}/convert-to-task`, { title: "de novo" }))).toBe("CONFLICT");
  });

  it("does not mark the item processed when the task is invalid", async () => {
    const item = await api.ok<InboxItem>("POST", "/api/inbox", { content: "x" });
    const res = await api.req("POST", `/api/inbox/${item.id}/convert-to-task`, { title: "x", projectId: "0190a0a0-0000-7000-8000-000000000099" });
    expect(res.status).toBe(404);
    expect(await api.ok<InboxItem[]>("GET", "/api/inbox?status=open")).toHaveLength(1);
  });
});

describe("trash", () => {
  it("project delete cascades, lists only the parent, restores together", async () => {
    const project = await api.ok<Project>("POST", "/api/projects", { name: "Viagem" });
    const task = await api.ok<Task>("POST", "/api/tasks", { title: "Passagens", projectId: project.id });
    const loose = await api.ok<Task>("POST", "/api/tasks", { title: "Solta" });
    await api.ok("DELETE", `/api/projects/${project.id}`);
    await api.ok("DELETE", `/api/tasks/${loose.id}`);

    const trash = await api.ok<TrashItem[]>("GET", "/api/trash");
    expect(trash.map((i) => `${i.entity}:${i.title}`).sort()).toEqual(["project:Viagem", "task:Solta"]);
    expect(await code(await api.req("POST", `/api/tasks/${task.id}/restore`))).toBe("CONFLICT"); // project first

    await api.ok("POST", `/api/projects/${project.id}/restore`);
    expect((await api.ok<Task[]>("GET", `/api/tasks?projectId=${project.id}`)).map((t) => t.id)).toEqual([task.id]);
  });

  it("purge requires the item to be in the trash, deletes permanently and is audited", async () => {
    const area = await api.ok<Area>("POST", "/api/areas", { name: "Temporária" });
    expect(await code(await api.req("DELETE", `/api/trash/area/${area.id}`))).toBe("CONFLICT");
    await api.ok("DELETE", `/api/areas/${area.id}`);
    await api.ok("DELETE", `/api/trash/area/${area.id}`);
    expect(await env.DB.prepare("select count(*) n from areas where id = ?").bind(area.id).first("n")).toBe(0);
    const audit = await env.DB.prepare("select action, entity_id, metadata from audit_logs where action = 'trash.purge'").first<{ entity_id: string; metadata: string }>();
    expect(audit?.entity_id).toBe(area.id);
    expect(JSON.parse(audit!.metadata)).toEqual({ title: "Temporária" });
    expect((await api.req("DELETE", `/api/trash/bogus/${area.id}`)).status).toBe(400);
  });

  it("empty trash purges children before parents and keeps FK integrity", async () => {
    const area = await api.ok<Area>("POST", "/api/areas", { name: "Área" });
    const project = await api.ok<Project>("POST", "/api/projects", { name: "Proj", areaId: area.id });
    await api.ok("POST", "/api/tasks", { title: "T", projectId: project.id });
    await api.ok("DELETE", `/api/projects/${project.id}`);
    await api.ok("DELETE", `/api/areas/${area.id}`);
    expect(await api.ok<{ purged: number }>("DELETE", "/api/trash")).toEqual({ purged: 2 });
    expect(await env.DB.prepare("select (select count(*) from tasks) + (select count(*) from projects) + (select count(*) from areas) n").first("n")).toBe(0);
    expect((await env.DB.prepare("pragma foreign_key_check").all()).results).toHaveLength(0);
  });
});
