import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { notebooks, resources } from "../../db/schema";

export type NotebookRow = typeof notebooks.$inferSelect;
export type ResourceRow = typeof resources.$inferSelect;

export class NotebookRepository {
  constructor(private readonly db: Database) {}

  list(archived: boolean) {
    return this.db
      .select({
        id: notebooks.id, name: notebooks.name, description: notebooks.description, icon: notebooks.icon,
        archivedAt: notebooks.archivedAt, deletedAt: notebooks.deletedAt,
        noteCount: sql<number>`(select count(*) from notes n where n.notebook_id = ${sql.raw("notebooks.id")} and n.deleted_at is null and n.archived_at is null)`,
      })
      .from(notebooks)
      .where(and(isNull(notebooks.deletedAt), archived ? isNotNull(notebooks.archivedAt) : isNull(notebooks.archivedAt)))
      .orderBy(asc(notebooks.position), asc(notebooks.name));
  }

  async findById(id: string): Promise<NotebookRow | undefined> {
    const [row] = await this.db.select().from(notebooks).where(eq(notebooks.id, id));
    return row;
  }

  async insert(values: typeof notebooks.$inferInsert): Promise<NotebookRow> {
    const [row] = await this.db.insert(notebooks).values(values).returning();
    if (!row) throw new Error("notebook insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof notebooks.$inferInsert>) {
    await this.db.update(notebooks).set(values).where(eq(notebooks.id, id));
  }

  async purge(id: string) {
    await this.db.delete(notebooks).where(eq(notebooks.id, id));
  }
}

export class ResourceRepository {
  constructor(private readonly db: Database) {}

  list(archived: boolean) {
    const r = sql.raw("resources.id");
    return this.db
      .select({
        id: resources.id, name: resources.name, description: resources.description, areaId: resources.areaId,
        archivedAt: resources.archivedAt, deletedAt: resources.deletedAt,
        notes: sql<number>`(select count(*) from notes n where n.resource_id = ${r} and n.deleted_at is null)`,
        bookmarks: sql<number>`(select count(*) from bookmarks b where b.resource_id = ${r} and b.deleted_at is null)`,
        books: sql<number>`(select count(*) from books b where b.resource_id = ${r} and b.deleted_at is null)`,
      })
      .from(resources)
      .where(and(isNull(resources.deletedAt), archived ? isNotNull(resources.archivedAt) : isNull(resources.archivedAt)))
      .orderBy(asc(resources.name));
  }

  async findById(id: string): Promise<ResourceRow | undefined> {
    const [row] = await this.db.select().from(resources).where(eq(resources.id, id));
    return row;
  }

  async insert(values: typeof resources.$inferInsert): Promise<ResourceRow> {
    const [row] = await this.db.insert(resources).values(values).returning();
    if (!row) throw new Error("resource insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof resources.$inferInsert>) {
    await this.db.update(resources).set(values).where(eq(resources.id, id));
  }

  async purge(id: string) {
    await this.db.delete(resources).where(eq(resources.id, id));
  }
}
