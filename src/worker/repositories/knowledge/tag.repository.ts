import { asc, eq, inArray, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Taggable } from "../../../shared/knowledge";
import type { Database } from "../../db/client";
import { bookmarkTags, bookTags, noteTags, projectTags, tags, taskTags } from "../../db/schema";
import { chunk } from "../_shared";

export type TagRow = typeof tags.$inferSelect;

/** Junction table + entity FK column per taggable entity (explicit junction tables, no polymorphic FK). */
const JUNCTIONS: Record<Taggable, { table: SQLiteTable; entityCol: SQLiteColumn; tagCol: SQLiteColumn; key: string }> = {
  note: { table: noteTags, entityCol: noteTags.noteId, tagCol: noteTags.tagId, key: "noteId" },
  task: { table: taskTags, entityCol: taskTags.taskId, tagCol: taskTags.tagId, key: "taskId" },
  project: { table: projectTags, entityCol: projectTags.projectId, tagCol: projectTags.tagId, key: "projectId" },
  bookmark: { table: bookmarkTags, entityCol: bookmarkTags.bookmarkId, tagCol: bookmarkTags.tagId, key: "bookmarkId" },
  book: { table: bookTags, entityCol: bookTags.bookId, tagCol: bookTags.tagId, key: "bookId" },
};

export class TagRepository {
  constructor(private readonly db: Database) {}

  list(): Promise<(TagRow & { usage: number })[]> {
    const usage = sql<number>`(select count(*) from note_tags where tag_id = tags.id)
      + (select count(*) from task_tags where tag_id = tags.id) + (select count(*) from project_tags where tag_id = tags.id)
      + (select count(*) from bookmark_tags where tag_id = tags.id) + (select count(*) from book_tags where tag_id = tags.id)`;
    return this.db.select({ id: tags.id, name: tags.name, color: tags.color, createdAt: tags.createdAt, updatedAt: tags.updatedAt, usage }).from(tags).orderBy(asc(sql`${tags.name} collate nocase`));
  }

  async findById(id: string): Promise<TagRow | undefined> {
    const [row] = await this.db.select().from(tags).where(eq(tags.id, id));
    return row;
  }

  async existingIds(ids: string[]): Promise<string[]> {
    const found: string[] = [];
    for (const part of chunk(ids)) found.push(...(await this.db.select({ id: tags.id }).from(tags).where(inArray(tags.id, part))).map((r) => r.id));
    return found;
  }

  async insert(values: typeof tags.$inferInsert): Promise<TagRow> {
    const [row] = await this.db.insert(tags).values(values).returning();
    if (!row) throw new Error("tag insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof tags.$inferInsert>): Promise<void> {
    await this.db.update(tags).set(values).where(eq(tags.id, id));
  }

  /** Hard delete: junction rows cascade via FK. */
  async delete(id: string): Promise<void> {
    await this.db.delete(tags).where(eq(tags.id, id));
  }

  /** Replaces the tag set of an entity atomically. */
  async setTags(entity: Taggable, entityId: string, tagIds: string[]): Promise<void> {
    const j = JUNCTIONS[entity];
    const del = this.db.delete(j.table).where(eq(j.entityCol, entityId));
    if (!tagIds.length) {
      await del;
      return;
    }
    const rows = tagIds.map((tagId) => ({ [j.key]: entityId, tagId }));
    await this.db.batch([del, this.db.insert(j.table).values(rows as never)]);
  }

  /** entityId → tagIds for many entities (chunked). */
  async tagIdsFor(entity: Taggable, entityIds: string[]): Promise<Map<string, string[]>> {
    const j = JUNCTIONS[entity];
    const map = new Map<string, string[]>(entityIds.map((id) => [id, []]));
    for (const part of chunk(entityIds)) {
      const rows = (await this.db.select({ e: j.entityCol, t: j.tagCol }).from(j.table).where(inArray(j.entityCol, part))) as { e: string; t: string }[];
      for (const r of rows) map.get(r.e)?.push(r.t);
    }
    return map;
  }

  /** Entity ids having a tag (for list filters). */
  entityIdsWithTag(entity: Taggable, tagId: string) {
    const j = JUNCTIONS[entity];
    return this.db.select({ id: j.entityCol }).from(j.table).where(eq(j.tagCol, tagId));
  }
}
