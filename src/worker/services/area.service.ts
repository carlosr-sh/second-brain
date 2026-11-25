import type { Area, CreateAreaInput, UpdateAreaInput } from "../../shared/para";
import { assertLive, conflict, notFound } from "../lib/errors";
import type { AreaRepository, AreaWithStats } from "../repositories/area.repository";
import { iso, isoRequired } from "../repositories/_shared";

export class AreaService {
  constructor(private readonly repo: AreaRepository) {}

  async list(archived: boolean): Promise<Area[]> {
    return (await this.repo.list(archived)).map(toDto);
  }

  async get(id: string): Promise<Area> {
    const row = await this.repo.findWithStats(id);
    if (!row || row.deletedAt) throw notFound("Área não encontrada");
    return toDto(row);
  }

  async create(input: CreateAreaInput): Promise<Area> {
    const row = await this.repo.insert({ ...input, position: await this.repo.nextPosition() });
    return this.get(row.id);
  }

  async update(id: string, input: UpdateAreaInput): Promise<Area> {
    const current = assertLive(await this.repo.findById(id), "Área");
    const { archived, ...values } = input;
    await this.repo.update(id, {
      ...values,
      ...(archived !== undefined ? { archivedAt: archived ? (current.archivedAt ?? new Date()) : null } : {}),
    });
    return this.get(id);
  }

  async trash(id: string): Promise<void> {
    assertLive(await this.repo.findById(id), "Área");
    await this.repo.update(id, { deletedAt: new Date() });
  }

  async restore(id: string): Promise<Area> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Área não encontrada");
    if (!row.deletedAt) throw conflict("A área não está na lixeira");
    await this.repo.update(id, { deletedAt: null });
    return this.get(id);
  }
}

function toDto(r: AreaWithStats): Area {
  return {
    id: r.id, name: r.name, description: r.description, icon: r.icon, color: r.color, position: r.position,
    archivedAt: iso(r.archivedAt), createdAt: isoRequired(r.createdAt), updatedAt: isoRequired(r.updatedAt),
    stats: { activeProjects: r.activeProjects, openTasks: r.openTasks },
  };
}
