import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { journalEntries } from "../../db/schema";

export type JournalRow = typeof journalEntries.$inferSelect;

export class JournalRepository {
  constructor(private readonly db: Database) {}

  list(from: string, to: string) {
    return this.db
      .select({
        id: journalEntries.id, date: journalEntries.entryDate, title: journalEntries.title, mood: journalEntries.mood,
        energy: journalEntries.energy, excerpt: sql<string>`substr(${journalEntries.contentText}, 1, 200)`,
      })
      .from(journalEntries)
      .where(and(isNull(journalEntries.deletedAt), gte(journalEntries.entryDate, from), lte(journalEntries.entryDate, to)))
      .orderBy(asc(journalEntries.entryDate));
  }

  /** The live entry of a date (at most one: partial unique index). */
  async findByDate(date: string): Promise<JournalRow | undefined> {
    const [row] = await this.db.select().from(journalEntries).where(and(eq(journalEntries.entryDate, date), isNull(journalEntries.deletedAt)));
    return row;
  }

  async findById(id: string): Promise<(JournalRow & { title: string }) | undefined> {
    const [row] = await this.db.select().from(journalEntries).where(eq(journalEntries.id, id));
    return row ? { ...row, title: row.title || row.entryDate } : undefined;
  }

  async insert(values: typeof journalEntries.$inferInsert): Promise<JournalRow> {
    const [row] = await this.db.insert(journalEntries).values(values).returning();
    if (!row) throw new Error("journal insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof journalEntries.$inferInsert>) {
    await this.db.update(journalEntries).set(values).where(eq(journalEntries.id, id));
  }

  async purge(id: string) {
    await this.db.delete(journalEntries).where(eq(journalEntries.id, id));
  }
}
