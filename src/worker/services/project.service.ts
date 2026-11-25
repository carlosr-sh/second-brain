import type { ProjectStatus } from "../../shared/enums";
import type { CreateProjectInput, Project, UpdateProjectInput } from "../../shared/para";
import { assertLive, conflict, notFound } from "../lib/errors";
import type { AreaRepository } from "../repositories/area.repository";
import type { GoalRepository } from "../repositories/goal.repository";
import type { ProjectRepository, ProjectWithStats } from "../repositories/project.repository";
import { iso, isoRequired } from "../repositories/_shared";

export class ProjectService {
  constructor(
    private readonly repo: ProjectRepository,
    private readonly areas: AreaRepository,
    private readonly goals: GoalRepository,
  ) {}

  async list(filter: { archived: boolean; areaId?: string; goalId?: string; status?: ProjectStatus[] }): Promise<Project[]> {
    return (await this.repo.list(filter)).map(toDto);
  }

  async get(id: string): Promise<Project> {
    const row = await this.repo.findWithStats(id);
    if (!row || row.deletedAt) throw notFound("Projeto não encontrado");
    return toDto(row);
  }

  private async checkRefs(input: { areaId?: string | null; goalId?: string | null }) {
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    if (input.goalId) assertLive(await this.goals.findById(input.goalId), "Meta");
  }

  async create(input: CreateProjectInput): Promise<Project> {
    await this.checkRefs(input);
    const row = await this.repo.insert({
      ...input,
      position: await this.repo.nextPosition(),
      completedAt: input.status === "completed" ? new Date() : null,
    });
    return this.get(row.id);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const current = assertLive(await this.repo.findById(id), "Projeto");
    await this.checkRefs(input);
    const { archived, ...values } = input;
    const set = {
      ...values,
      ...(input.status ? { completedAt: input.status === "completed" ? (current.completedAt ?? new Date()) : null } : {}),
    };

    if (archived === true && !current.archivedAt) {
      const now = new Date();
      await this.repo.updateWithCascade(id, { ...set, archivedAt: now }, { field: "archivedAt", to: now, from: null });
    } else if (archived === false && current.archivedAt) {
      await this.repo.updateWithCascade(id, { ...set, archivedAt: null }, { field: "archivedAt", to: null, from: current.archivedAt });
    } else {
      await this.repo.updateWithCascade(id, set);
    }
    return this.get(id);
  }

  async trash(id: string): Promise<void> {
    assertLive(await this.repo.findById(id), "Projeto");
    const now = new Date();
    await this.repo.updateWithCascade(id, { deletedAt: now }, { field: "deletedAt", to: now, from: null });
  }

  async restore(id: string): Promise<Project> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Projeto não encontrado");
    if (!row.deletedAt) throw conflict("O projeto não está na lixeira");
    await this.repo.updateWithCascade(id, { deletedAt: null }, { field: "deletedAt", to: null, from: row.deletedAt });
    return this.get(id);
  }
}

function toDto(r: ProjectWithStats): Project {
  return {
    id: r.id, areaId: r.areaId, goalId: r.goalId, name: r.name, description: r.description, status: r.status,
    priority: r.priority, startDate: r.startDate, dueDate: r.dueDate, completedAt: iso(r.completedAt), position: r.position,
    archivedAt: iso(r.archivedAt), createdAt: isoRequired(r.createdAt), updatedAt: isoRequired(r.updatedAt),
    taskStats: { open: r.openTasks, done: r.doneTasks },
  };
}
