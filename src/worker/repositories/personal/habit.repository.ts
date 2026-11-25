import { and, asc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import { habitLogs, habits } from "../../db/schema";
import { chunk } from "../_shared";

export type HabitRow = typeof habits.$inferSelect;

export class HabitRepository {
  constructor(private readonly db: Database) {}

  list(archived: boolean) {
    return this.db
      .select()
      .from(habits)
      .where(and(isNull(habits.deletedAt), archived ? isNotNull(habits.archivedAt) : isNull(habits.archivedAt)))
      .orderBy(asc(habits.createdAt));
  }

  async findById(id: string): Promise<HabitRow | undefined> {
    const [row] = await this.db.select().from(habits).where(eq(habits.id, id));
    return row;
  }

  async logsSince(habitIds: string[], from: string) {
    const out: { habitId: string; date: string; count: number }[] = [];
    for (const part of chunk(habitIds, 80)) {
      out.push(
        ...(await this.db
          .select({ habitId: habitLogs.habitId, date: habitLogs.date, count: habitLogs.count })
          .from(habitLogs)
          .where(and(inArray(habitLogs.habitId, part), gte(habitLogs.date, from)))
          .orderBy(asc(habitLogs.date))),
      );
    }
    return out;
  }

  /** Upsert of the day's log (unique habit+date); count 0 removes it. */
  async setLog(habitId: string, date: string, count: number, note: string | null) {
    if (count === 0) {
      await this.db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
      return;
    }
    await this.db
      .insert(habitLogs)
      .values({ habitId, date, count, note })
      .onConflictDoUpdate({ target: [habitLogs.habitId, habitLogs.date], set: { count, note, updatedAt: new Date() } });
  }

  async insert(values: typeof habits.$inferInsert): Promise<HabitRow> {
    const [row] = await this.db.insert(habits).values(values).returning();
    if (!row) throw new Error("habit insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof habits.$inferInsert>) {
    await this.db.update(habits).set(values).where(eq(habits.id, id));
  }

  async purge(id: string) {
    await this.db.delete(habits).where(eq(habits.id, id)); // logs cascade
  }
}
