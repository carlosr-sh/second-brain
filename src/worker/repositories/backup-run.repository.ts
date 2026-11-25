import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { backupRuns } from "../db/schema";

export type NewBackupRun = typeof backupRuns.$inferInsert;
export type BackupRunRow = typeof backupRuns.$inferSelect;

export class BackupRunRepository {
  constructor(private readonly db: Database) {}

  async start(kind: NewBackupRun["kind"], metadata?: Record<string, unknown>): Promise<BackupRunRow> {
    const [row] = await this.db.insert(backupRuns).values({ kind, metadata }).returning();
    if (!row) throw new Error("backup run insert returned no row");
    return row;
  }

  async finish(
    id: string,
    result: Pick<NewBackupRun, "status" | "error" | "itemCount" | "sizeBytes" | "checksum" | "location" | "metadata">,
  ): Promise<void> {
    await this.db
      .update(backupRuns)
      .set({ ...result, finishedAt: new Date() })
      .where(eq(backupRuns.id, id));
  }
}
