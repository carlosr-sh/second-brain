/**
 * Low-level database introspection. Uses the raw D1 binding on purpose:
 * PRAGMAs and the Wrangler-managed `d1_migrations` table are outside the
 * Drizzle schema.
 *
 * Note: D1 does NOT authorize `PRAGMA integrity_check`; `quick_check` and
 * `foreign_key_check` are allowed and are what we use.
 */
export class SystemRepository {
  constructor(private readonly d1: D1Database) {}

  async ping(): Promise<void> {
    await this.d1.prepare("select 1 as ok").first();
  }

  async appliedMigrations(): Promise<string[]> {
    try {
      const { results } = await this.d1
        .prepare("select name from d1_migrations order by id")
        .all<{ name: string }>();
      return results.map((r) => r.name);
    } catch {
      return []; // table absent => no migrations applied through Wrangler
    }
  }

  async quickCheck(): Promise<string> {
    const { results } = await this.d1.prepare("pragma quick_check").all<{ quick_check: string }>();
    return results.map((r) => r.quick_check).join("; ") || "unknown";
  }

  async foreignKeyViolations(): Promise<number> {
    const { results } = await this.d1.prepare("pragma foreign_key_check").all();
    return results.length;
  }
}
