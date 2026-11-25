import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { InboxStatusFilter } from "../../shared/inbox";
import type { Database } from "../db/client";
import { inboxItems } from "../db/schema";

export type InboxItemRow = typeof inboxItems.$inferSelect;

export class InboxRepository {
  constructor(private readonly db: Database) {}

  list(status: InboxStatusFilter, limit = 200): Promise<InboxItemRow[]> {
    const filters: SQL[] = [isNull(inboxItems.deletedAt)];
    if (status === "open") filters.push(isNull(inboxItems.processedAt));
    if (status === "processed") filters.push(isNotNull(inboxItems.processedAt));
    return this.db
      .select()
      .from(inboxItems)
      .where(and(...filters))
      .orderBy(desc(inboxItems.createdAt), desc(inboxItems.id))
      .limit(limit);
  }

  async findById(id: string): Promise<InboxItemRow | undefined> {
    const [row] = await this.db.select().from(inboxItems).where(eq(inboxItems.id, id));
    return row;
  }

  async countOpen(): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(inboxItems)
      .where(and(isNull(inboxItems.deletedAt), isNull(inboxItems.processedAt)));
    return row?.n ?? 0;
  }

  async create(values: { content: string; url: string | null }): Promise<InboxItemRow> {
    const [row] = await this.db.insert(inboxItems).values(values).returning();
    if (!row) throw new Error("inbox insert returned no row");
    return row;
  }

  /** Returns the updated row, or undefined when it does not exist / is deleted. */
  async update(id: string, values: Partial<Pick<InboxItemRow, "processedAt" | "deletedAt">>): Promise<InboxItemRow | undefined> {
    const [row] = await this.db
      .update(inboxItems)
      .set(values)
      .where(and(eq(inboxItems.id, id), isNull(inboxItems.deletedAt)))
      .returning();
    return row;
  }
}
