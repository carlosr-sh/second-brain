import { desc } from "drizzle-orm";
import type { Database } from "../db/client";
import { auditLogs } from "../db/schema";

export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLogRow = typeof auditLogs.$inferSelect;

export class AuditLogRepository {
  constructor(private readonly db: Database) {}

  async insert(entry: NewAuditLog): Promise<AuditLogRow> {
    const [row] = await this.db.insert(auditLogs).values(entry).returning();
    if (!row) throw new Error("audit log insert returned no row");
    return row;
  }

  listRecent(limit: number): Promise<AuditLogRow[]> {
    return this.db.select().from(auditLogs).orderBy(desc(auditLogs.occurredAt), desc(auditLogs.id)).limit(limit);
  }
}
