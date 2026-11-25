import type { CreateTaskInput, Task, TaskListQuery, TaskUpdateResult, UpdateTaskInput } from "../../shared/para";
import { nextOccurrence, parseRule } from "../../shared/recurrence";
import { assertLive, badRequest, conflict, notFound } from "../lib/errors";
import type { AreaRepository } from "../repositories/area.repository";
import type { InboxRepository } from "../repositories/inbox.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ChildOp, NewTask, TaskRepository, TaskRow } from "../repositories/task.repository";
import { iso, isoRequired } from "../repositories/_shared";

interface Location {
  projectId: string | null;
  areaId: string | null;
  parentTaskId: string | null;
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly areas: AreaRepository,
    private readonly inbox: InboxRepository,
    /** Today's calendar date in the app timezone (injected for testability). */
    private readonly today: () => string,
  ) {}

  async list(q: TaskListQuery): Promise<Task[]> {
    return (await this.repo.list(q)).map(toDto);
  }

  async get(id: string): Promise<Task> {
    return toDto(assertLive(await this.repo.findById(id), "Tarefa"));
  }

  /**
   * PARA location rules:
   *  - a subtask inherits project/area from its parent; only one level deep
   *  - otherwise a task lives in a project OR an area OR neither
   * Setting projectId implicitly clears areaId (and vice versa) unless both are sent.
   */
  private async resolveLocation(input: Partial<Location>, current?: TaskRow): Promise<Location> {
    const parentTaskId = input.parentTaskId !== undefined ? input.parentTaskId : (current?.parentTaskId ?? null);
    if (parentTaskId) {
      const parent = assertLive(await this.repo.findById(parentTaskId), "Tarefa-pai");
      if (current && parent.id === current.id) throw conflict("Uma tarefa não pode ser subtarefa de si mesma");
      if (parent.parentTaskId) throw conflict("Subtarefas não podem ter subtarefas");
      if (current && (await this.repo.countChildren(current.id)) > 0) {
        throw conflict("Uma tarefa que tem subtarefas não pode virar subtarefa");
      }
      return { parentTaskId: parent.id, projectId: parent.projectId, areaId: parent.areaId };
    }

    let projectId = input.projectId !== undefined ? input.projectId : (current?.projectId ?? null);
    let areaId = input.areaId !== undefined ? input.areaId : (current?.areaId ?? null);
    if (input.projectId && input.areaId === undefined) areaId = null;
    if (input.areaId && input.projectId === undefined) projectId = null;
    if (projectId && areaId) throw badRequest("Uma tarefa fica em um projeto OU em uma área, não nos dois");
    if (projectId) assertLive(await this.projects.findById(projectId), "Projeto");
    if (areaId) assertLive(await this.areas.findById(areaId), "Área");
    return { parentTaskId: null, projectId, areaId };
  }

  private async buildNew(input: CreateTaskInput): Promise<NewTask> {
    const { parentTaskId, projectId, areaId, ...fields } = input;
    const location = await this.resolveLocation({ parentTaskId, projectId, areaId });
    return {
      ...fields,
      ...location,
      position: await this.repo.nextPosition(),
      completedAt: fields.status === "done" ? new Date() : null,
    };
  }

  async create(input: CreateTaskInput): Promise<Task> {
    return toDto(await this.repo.insert(await this.buildNew(input)));
  }

  async convertFromInbox(inboxId: string, input: CreateTaskInput): Promise<Task> {
    const item = await this.inbox.findById(inboxId);
    if (!item || item.deletedAt) throw notFound("Item da Inbox não encontrado");
    if (item.processedAt) throw conflict("Este item da Inbox já foi processado");
    return toDto(await this.repo.insertFromInbox(await this.buildNew(input), inboxId));
  }

  async update(id: string, input: UpdateTaskInput): Promise<TaskUpdateResult> {
    const current = assertLive(await this.repo.findById(id), "Tarefa");
    const { archived, parentTaskId, projectId, areaId, ...fields } = input;
    const set: Partial<NewTask> = { ...fields };
    const children: ChildOp[] = [];

    // Location (and propagation to subtasks).
    if (parentTaskId !== undefined || projectId !== undefined || areaId !== undefined) {
      const location = await this.resolveLocation({ parentTaskId, projectId, areaId }, current);
      Object.assign(set, location);
      children.push({ set: { projectId: location.projectId, areaId: location.areaId } });
    }

    // Completion bookkeeping + recurrence.
    let spawn: NewTask | undefined;
    if (fields.status && fields.status !== current.status) {
      set.completedAt = fields.status === "done" ? new Date() : null;
      const ruleText = fields.recurrenceRule !== undefined ? fields.recurrenceRule : current.recurrenceRule;
      const rule = ruleText ? parseRule(ruleText) : null;
      if (fields.status === "done" && rule) {
        const base = fields.dueDate !== undefined ? fields.dueDate : current.dueDate;
        spawn = {
          title: fields.title ?? current.title,
          notes: fields.notes !== undefined ? fields.notes : current.notes,
          priority: fields.priority ?? current.priority,
          projectId: (set.projectId !== undefined ? set.projectId : current.projectId) ?? null,
          areaId: (set.areaId !== undefined ? set.areaId : current.areaId) ?? null,
          parentTaskId: (set.parentTaskId !== undefined ? set.parentTaskId : current.parentTaskId) ?? null,
          recurrenceRule: ruleText,
          dueDate: nextOccurrence(base ?? this.today(), rule),
          status: "todo",
          position: await this.repo.nextPosition(),
        };
        set.recurrenceRule = null; // the rule moves to the next occurrence
      }
    }

    // Archive state (cascades to subtasks with the same timestamp).
    if (archived === true && !current.archivedAt) {
      const now = new Date();
      set.archivedAt = now;
      children.push({ set: { archivedAt: now }, onlyWhere: { field: "archivedAt", equals: null } });
    } else if (archived === false && current.archivedAt) {
      await this.assertContainersActive(current, "archivedAt");
      set.archivedAt = null;
      children.push({ set: { archivedAt: null }, onlyWhere: { field: "archivedAt", equals: current.archivedAt } });
    }

    const spawned = await this.repo.updateAtomic(id, set, { children, spawn });
    return { task: await this.get(id), spawned: spawned ? toDto(spawned) : null };
  }

  /** A task cannot be brought back while its project or parent is still archived/deleted. */
  private async assertContainersActive(task: TaskRow, field: "archivedAt" | "deletedAt") {
    const label = field === "archivedAt" ? "Desarquive" : "Restaure";
    if (task.projectId) {
      const project = await this.projects.findById(task.projectId);
      if (project?.[field]) throw conflict(`${label} o projeto primeiro`);
    }
    if (task.parentTaskId) {
      const parent = await this.repo.findById(task.parentTaskId);
      if (parent?.[field]) throw conflict(`${label} a tarefa-pai primeiro`);
    }
  }

  async trash(id: string): Promise<void> {
    assertLive(await this.repo.findById(id), "Tarefa");
    const now = new Date();
    await this.repo.updateAtomic(id, { deletedAt: now }, { children: [{ set: { deletedAt: now }, onlyWhere: { field: "deletedAt", equals: null } }] });
  }

  async restore(id: string): Promise<Task> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Tarefa não encontrada");
    if (!row.deletedAt) throw conflict("A tarefa não está na lixeira");
    await this.assertContainersActive(row, "deletedAt");
    await this.repo.updateAtomic(id, { deletedAt: null }, { children: [{ set: { deletedAt: null }, onlyWhere: { field: "deletedAt", equals: row.deletedAt } }] });
    return this.get(id);
  }
}

export function toDto(r: TaskRow): Task {
  return {
    id: r.id, projectId: r.projectId, areaId: r.areaId, parentTaskId: r.parentTaskId, title: r.title, notes: r.notes,
    status: r.status, priority: r.priority, dueDate: r.dueDate, scheduledDate: r.scheduledDate,
    recurrenceRule: r.recurrenceRule, completedAt: iso(r.completedAt), position: r.position,
    archivedAt: iso(r.archivedAt), createdAt: isoRequired(r.createdAt), updatedAt: isoRequired(r.updatedAt),
  };
}
