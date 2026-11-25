import { and, desc, eq, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/client";
import { bookNotes, files, inboxItems, noteAttachments, noteLinks, notes } from "../../db/schema";
import { chunk } from "../_shared";

export type NoteRow = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export interface NoteFilter {
  archived: boolean;
  notebookId?: string;
  projectId?: string;
  areaId?: string;
  resourceId?: string;
  ids?: SQL; // subquery of ids (tag / book filters)
}

const summaryColumns = {
  id: notes.id, title: notes.title, notebookId: notes.notebookId, projectId: notes.projectId, areaId: notes.areaId,
  resourceId: notes.resourceId, isPinned: notes.isPinned, isFavorite: notes.isFavorite, archivedAt: notes.archivedAt,
  deletedAt: notes.deletedAt, createdAt: notes.createdAt, updatedAt: notes.updatedAt,
  excerpt: sql<string>`substr(${notes.contentText}, 1, 240)`,
};

export class NoteRepository {
  constructor(private readonly db: Database) {}

  list(f: NoteFilter, limit = 500) {
    const where: SQL[] = [isNull(notes.deletedAt), f.archived ? isNotNull(notes.archivedAt) : isNull(notes.archivedAt)];
    if (f.notebookId) where.push(eq(notes.notebookId, f.notebookId));
    if (f.projectId) where.push(eq(notes.projectId, f.projectId));
    if (f.areaId) where.push(eq(notes.areaId, f.areaId));
    if (f.resourceId) where.push(eq(notes.resourceId, f.resourceId));
    if (f.ids) where.push(sql`${notes.id} in (${f.ids})`);
    return this.db.select(summaryColumns).from(notes).where(and(...where)).orderBy(desc(notes.isPinned), desc(notes.updatedAt)).limit(limit);
  }

  async findById(id: string): Promise<NoteRow | undefined> {
    const [row] = await this.db.select().from(notes).where(eq(notes.id, id));
    return row;
  }

  /** Live note ids among `ids` (chunked). */
  async liveIds(ids: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const part of chunk(ids)) {
      out.push(...(await this.db.select({ id: notes.id }).from(notes).where(and(inArray(notes.id, part), isNull(notes.deletedAt)))).map((r) => r.id));
    }
    return out;
  }

  async liveFileIds(ids: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const part of chunk(ids)) {
      out.push(...(await this.db.select({ id: files.id }).from(files).where(and(inArray(files.id, part), isNull(files.deletedAt)))).map((r) => r.id));
    }
    return out;
  }

  /**
   * Inserts or updates a note and, when content changed, re-derives its
   * outgoing links and attachments — all in one atomic batch.
   */
  async save(
    mode: { insert: NewNote } | { update: { id: string; values: Partial<NewNote> } },
    derived?: { linkTargets: string[]; fileIds: string[] },
    extra?: { bookId?: string; processInboxId?: string },
  ): Promise<string> {
    const id = "insert" in mode ? (mode.insert.id as string) : mode.update.id;
    const ops = [
      "insert" in mode ? this.db.insert(notes).values(mode.insert) : this.db.update(notes).set(mode.update.values).where(eq(notes.id, id)),
    ] as const;
    const rest = [];
    if (derived) {
      rest.push(this.db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, id)));
      if (derived.linkTargets.length) rest.push(this.db.insert(noteLinks).values(derived.linkTargets.map((t) => ({ sourceNoteId: id, targetNoteId: t }))));
      rest.push(this.db.delete(noteAttachments).where(eq(noteAttachments.noteId, id)));
      if (derived.fileIds.length) rest.push(this.db.insert(noteAttachments).values(derived.fileIds.map((f) => ({ noteId: id, fileId: f }))));
    }
    if (extra?.bookId) rest.push(this.db.insert(bookNotes).values({ bookId: extra.bookId, noteId: id }));
    if (extra?.processInboxId) rest.push(this.db.update(inboxItems).set({ processedAt: new Date() }).where(eq(inboxItems.id, extra.processInboxId)));
    if (rest.length) await this.db.batch([...ops, ...rest]);
    else await ops[0];
    return id;
  }

  /** Live notes that link TO `id`. */
  backlinks(id: string) {
    return this.db
      .select({ id: notes.id, title: notes.title, excerpt: sql<string>`substr(${notes.contentText}, 1, 160)` })
      .from(noteLinks)
      .innerJoin(notes, eq(notes.id, noteLinks.sourceNoteId))
      .where(and(eq(noteLinks.targetNoteId, id), isNull(notes.deletedAt), ne(notes.id, id)))
      .orderBy(desc(notes.updatedAt));
  }

  bookNoteIds(bookId: string) {
    return this.db.select({ id: bookNotes.noteId }).from(bookNotes).where(eq(bookNotes.bookId, bookId));
  }

  async update(id: string, values: Partial<NewNote>) {
    await this.db.update(notes).set(values).where(eq(notes.id, id));
  }

  async purge(id: string) {
    await this.db.delete(notes).where(eq(notes.id, id));
  }
}
