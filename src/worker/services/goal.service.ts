import type { CreateGoalInput, Goal, UpdateGoalInput } from "../../shared/para";
import { assertLive, conflict, notFound } from "../lib/errors";
import type { AreaRepository } from "../repositories/area.repository";
import type { GoalRepository, GoalWithProgress } from "../repositories/goal.repository";
import { iso, isoRequired } from "../repositories/_shared";

export class GoalService {
  constructor(
    private readonly repo: GoalRepository,
    private readonly areas: AreaRepository,
  ) {}

  async list(filter: { archived: boolean; areaId?: string }): Promise<Goal[]> {
    return (await this.repo.list(filter)).map(toDto);
  }

  async get(id: string): Promise<Goal> {
    const row = await this.repo.findWithProgress(id);
    if (!row || row.deletedAt) throw notFound("Meta não encontrada");
    return toDto(row);
  }

  async create(input: CreateGoalInput): Promise<Goal> {
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    const row = await this.repo.insert({ ...input, achievedAt: input.status === "achieved" ? new Date() : null });
    return this.get(row.id);
  }

  async update(id: string, input: UpdateGoalInput): Promise<Goal> {
    const current = assertLive(await this.repo.findById(id), "Meta");
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    const { archived, ...values } = input;
    await this.repo.update(id, {
      ...values,
      ...(input.status ? { achievedAt: input.status === "achieved" ? (current.achievedAt ?? new Date()) : null } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? (current.archivedAt ?? new Date()) : null } : {}),
    });
    return this.get(id);
  }

  async trash(id: string): Promise<void> {
    assertLive(await this.repo.findById(id), "Meta");
    await this.repo.update(id, { deletedAt: new Date() });
  }

  async restore(id: string): Promise<Goal> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Meta não encontrada");
    if (!row.deletedAt) throw conflict("A meta não está na lixeira");
    await this.repo.update(id, { deletedAt: null });
    return this.get(id);
  }
}

function toDto(r: GoalWithProgress): Goal {
  return {
    id: r.id, areaId: r.areaId, title: r.title, description: r.description, status: r.status, horizon: r.horizon,
    targetDate: r.targetDate, achievedAt: iso(r.achievedAt), archivedAt: iso(r.archivedAt),
    createdAt: isoRequired(r.createdAt), updatedAt: isoRequired(r.updatedAt),
    progress: { completed: r.completedProjects, total: r.totalProjects },
  };
}
