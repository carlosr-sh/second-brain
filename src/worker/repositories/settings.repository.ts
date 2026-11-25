import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { settings } from "../db/schema";

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async getAll(): Promise<Map<string, unknown>> {
    const rows = await this.db.select().from(settings);
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  async upsert(key: string, value: unknown): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: sql`(cast(unixepoch('subsec') * 1000 as integer))` } });
  }
}
