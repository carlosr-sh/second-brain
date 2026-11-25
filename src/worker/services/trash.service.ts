import type { TrashEntity, TrashItem } from "../../shared/para";
import { conflict, notFound } from "../lib/errors";
import type { TrashRepository } from "../repositories/trash.repository";

interface PurgeableRepo {
  findById(id: string): Promise<({ deletedAt: Date | null } & ({ name: string } | { title: string })) | undefined>;
  purge(id: string): Promise<void>;
}

/** Permanent deletion. Only items already in the trash can be purged. */
export class TrashService {
  constructor(
    private readonly trash: TrashRepository,
    private readonly repos: Record<TrashEntity, PurgeableRepo>,
  ) {}

  list(): Promise<TrashItem[]> {
    return this.trash.list();
  }

  async purge(entity: TrashEntity, id: string): Promise<{ title: string }> {
    const repo = this.repos[entity];
    const row = await repo.findById(id);
    if (!row) throw notFound("Item não encontrado");
    if (!row.deletedAt) throw conflict("Só itens na lixeira podem ser excluídos definitivamente");
    await repo.purge(id);
    return { title: "name" in row ? row.name : row.title };
  }

  /** Empties the trash, children before parents. Returns how many items were purged. */
  async empty(): Promise<number> {
    const items = await this.trash.list();
    // Children before parents (FK order).
    const order: TrashEntity[] = ["task", "note", "bookmark", "book", "project", "goal", "resource", "notebook", "area"];
    let purged = 0;
    for (const entity of order) {
      for (const item of items.filter((i) => i.entity === entity)) {
        const row = await this.repos[entity].findById(item.id);
        if (row?.deletedAt) {
          await this.repos[entity].purge(item.id);
          purged++;
        }
      }
    }
    return purged;
  }
}
