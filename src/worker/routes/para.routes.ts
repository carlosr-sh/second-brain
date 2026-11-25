import { Hono, type Context } from "hono";
import { z } from "zod";
import type { ApiSuccess } from "../../shared/api";
import { PROJECT_STATUS } from "../../shared/enums";
import {
  convertInboxToTaskSchema,
  createAreaSchema,
  createGoalSchema,
  createProjectSchema,
  createTaskSchema,
  listArchivedQuerySchema,
  taskListQuerySchema,
  updateAreaSchema,
  updateGoalSchema,
  updateProjectSchema,
  updateTaskSchema,
  type Area,
  type Goal,
  type Project,
  type Task,
  type TaskUpdateResult,
  type TrashEntity,
  type TrashItem,
} from "../../shared/para";
import { UUID_REGEX } from "../../shared/uuid";
import { requestMeta } from "../lib/request-meta";
import { parseIdParam, parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types";

const ok = <T>(c: Context<AppEnv>, data: T, status: 200 | 201 = 200) => c.json<ApiSuccess<T>>({ data }, status);
const idOf = (c: Context<AppEnv>) => parseIdParam(c.req.param("id"));
const optionalId = z.string().regex(UUID_REGEX).optional();
const archivedOf = (c: Context<AppEnv>) => listArchivedQuerySchema.parse(c.req.query()).archived === "true";

export const areaRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok<Area[]>(c, await c.get("services").areas.list(archivedOf(c))))
  .post("/", async (c) => ok<Area>(c, await c.get("services").areas.create(await parseJsonBody(c, createAreaSchema)), 201))
  .get("/:id", async (c) => ok<Area>(c, await c.get("services").areas.get(idOf(c))))
  .patch("/:id", async (c) => ok<Area>(c, await c.get("services").areas.update(idOf(c), await parseJsonBody(c, updateAreaSchema))))
  .delete("/:id", async (c) => {
    await c.get("services").areas.trash(idOf(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => ok<Area>(c, await c.get("services").areas.restore(idOf(c))));

const goalQuery = z.object({ areaId: optionalId });
export const goalRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { areaId } = goalQuery.parse(c.req.query());
    return ok<Goal[]>(c, await c.get("services").goals.list({ archived: archivedOf(c), areaId }));
  })
  .post("/", async (c) => ok<Goal>(c, await c.get("services").goals.create(await parseJsonBody(c, createGoalSchema)), 201))
  .get("/:id", async (c) => ok<Goal>(c, await c.get("services").goals.get(idOf(c))))
  .patch("/:id", async (c) => ok<Goal>(c, await c.get("services").goals.update(idOf(c), await parseJsonBody(c, updateGoalSchema))))
  .delete("/:id", async (c) => {
    await c.get("services").goals.trash(idOf(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => ok<Goal>(c, await c.get("services").goals.restore(idOf(c))));

const projectQuery = z.object({
  areaId: optionalId,
  goalId: optionalId,
  status: z.string().transform((s) => s.split(",").filter(Boolean)).pipe(z.array(z.enum(PROJECT_STATUS))).optional(),
});
export const projectRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const q = projectQuery.parse(c.req.query());
    return ok<Project[]>(c, await c.get("services").projects.list({ archived: archivedOf(c), ...q }));
  })
  .post("/", async (c) => ok<Project>(c, await c.get("services").projects.create(await parseJsonBody(c, createProjectSchema)), 201))
  .get("/:id", async (c) => ok<Project>(c, await c.get("services").projects.get(idOf(c))))
  .patch("/:id", async (c) => ok<Project>(c, await c.get("services").projects.update(idOf(c), await parseJsonBody(c, updateProjectSchema))))
  .delete("/:id", async (c) => {
    await c.get("services").projects.trash(idOf(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => ok<Project>(c, await c.get("services").projects.restore(idOf(c))));

export const taskRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok<Task[]>(c, await c.get("services").tasks.list(taskListQuerySchema.parse(c.req.query()))))
  .post("/", async (c) => ok<Task>(c, await c.get("services").tasks.create(await parseJsonBody(c, createTaskSchema)), 201))
  .get("/:id", async (c) => ok<Task>(c, await c.get("services").tasks.get(idOf(c))))
  .patch("/:id", async (c) =>
    ok<TaskUpdateResult>(c, await c.get("services").tasks.update(idOf(c), await parseJsonBody(c, updateTaskSchema))),
  )
  .delete("/:id", async (c) => {
    await c.get("services").tasks.trash(idOf(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => ok<Task>(c, await c.get("services").tasks.restore(idOf(c))));

/** Inbox → task: creates the task and marks the item processed atomically. */
export const inboxConvertRoutes = new Hono<AppEnv>().post("/:id/convert-to-task", async (c) =>
  ok<Task>(c, await c.get("services").tasks.convertFromInbox(idOf(c), await parseJsonBody(c, convertInboxToTaskSchema)), 201),
);

const entitySchema = z.enum(["area", "goal", "project", "task", "note", "notebook", "resource", "bookmark", "book"]);
export const trashRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok<TrashItem[]>(c, await c.get("services").trash.list()))
  .delete("/:entity/:id", async (c) => {
    const entity: TrashEntity = entitySchema.parse(c.req.param("entity"));
    const id = idOf(c);
    const services = c.get("services");
    const { title } = await services.trash.purge(entity, id);
    await services.audit.record(requestMeta(c), { action: "trash.purge", entityType: entity, entityId: id, metadata: { title } });
    return c.body(null, 204);
  })
  .delete("/", async (c) => {
    const services = c.get("services");
    const purged = await services.trash.empty();
    await services.audit.record(requestMeta(c), { action: "trash.empty", metadata: { purged } });
    return ok(c, { purged });
  });
