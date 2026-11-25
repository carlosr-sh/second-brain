import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/client";
import { bookmarks, books, files } from "../../db/schema";

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type BookRow = typeof books.$inferSelect;
export type FileRow = typeof files.$inferSelect;

export class BookmarkRepository {
  constructor(private readonly db: Database) {}

  list(f: { archived: boolean; resourceId?: string; unread?: boolean; ids?: SQL }) {
    const where: SQL[] = [isNull(bookmarks.deletedAt), f.archived ? isNotNull(bookmarks.archivedAt) : isNull(bookmarks.archivedAt)];
    if (f.resourceId) where.push(eq(bookmarks.resourceId, f.resourceId));
    if (f.unread) where.push(isNull(bookmarks.readAt));
    if (f.ids) where.push(sql`${bookmarks.id} in (${f.ids})`);
    return this.db.select().from(bookmarks).where(and(...where)).orderBy(desc(bookmarks.isFavorite), desc(bookmarks.createdAt)).limit(1000);
  }

  async findById(id: string): Promise<BookmarkRow | undefined> {
    const [row] = await this.db.select().from(bookmarks).where(eq(bookmarks.id, id));
    return row;
  }

  async insert(values: typeof bookmarks.$inferInsert): Promise<BookmarkRow> {
    const [row] = await this.db.insert(bookmarks).values(values).returning();
    if (!row) throw new Error("bookmark insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof bookmarks.$inferInsert>) {
    await this.db.update(bookmarks).set(values).where(eq(bookmarks.id, id));
  }

  async purge(id: string) {
    await this.db.delete(bookmarks).where(eq(bookmarks.id, id));
  }
}

export class BookRepository {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select({
        book: books,
        noteCount: sql<number>`(select count(*) from book_notes bn join notes n on n.id = bn.note_id where bn.book_id = ${sql.raw("books.id")} and n.deleted_at is null)`,
      })
      .from(books);
  }

  list(f: { archived: boolean; resourceId?: string; ids?: SQL }) {
    const where: SQL[] = [isNull(books.deletedAt), f.archived ? isNotNull(books.archivedAt) : isNull(books.archivedAt)];
    if (f.resourceId) where.push(eq(books.resourceId, f.resourceId));
    if (f.ids) where.push(sql`${books.id} in (${f.ids})`);
    return this.select().where(and(...where)).orderBy(desc(books.updatedAt)).limit(1000);
  }

  async findWithCount(id: string) {
    const [row] = await this.select().where(eq(books.id, id));
    return row;
  }

  async findById(id: string): Promise<BookRow | undefined> {
    const [row] = await this.db.select().from(books).where(eq(books.id, id));
    return row;
  }

  async insert(values: typeof books.$inferInsert): Promise<BookRow> {
    const [row] = await this.db.insert(books).values(values).returning();
    if (!row) throw new Error("book insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof books.$inferInsert>) {
    await this.db.update(books).set(values).where(eq(books.id, id));
  }

  async purge(id: string) {
    await this.db.delete(books).where(eq(books.id, id));
  }
}

export class FileRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<FileRow | undefined> {
    const [row] = await this.db.select().from(files).where(eq(files.id, id));
    return row;
  }

  async insert(values: typeof files.$inferInsert): Promise<FileRow> {
    const [row] = await this.db.insert(files).values(values).returning();
    if (!row) throw new Error("file insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof files.$inferInsert>) {
    await this.db.update(files).set(values).where(eq(files.id, id));
  }
}
