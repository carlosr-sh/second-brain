import type { CheckResult, IntegrityCheckResponse, SystemStatusResponse } from "../../shared/api";
import type { BackupRunRepository } from "../repositories/backup-run.repository";
import type { SystemRepository } from "../repositories/system.repository";

export const APP_VERSION = "0.1.0";

export class SystemService {
  constructor(
    private readonly system: SystemRepository,
    private readonly backupRuns: BackupRunRepository,
    private readonly files: R2Bucket,
    private readonly environment: string,
  ) {}

  async status(): Promise<SystemStatusResponse> {
    const [database, storage, migrations] = await Promise.all([
      timed(() => this.system.ping()),
      timed(async () => {
        await this.files.list({ limit: 1 });
      }),
      this.system.appliedMigrations(),
    ]);
    return {
      version: APP_VERSION,
      environment: this.environment,
      serverTime: new Date().toISOString(),
      checks: { database, storage },
      migrations,
    };
  }

  /** Runs SQLite consistency checks and records the run in `backup_runs`. */
  async integrityCheck(): Promise<IntegrityCheckResponse> {
    const run = await this.backupRuns.start("integrity_check");
    try {
      const [quickCheck, foreignKeyViolations] = await Promise.all([
        this.system.quickCheck(),
        this.system.foreignKeyViolations(),
      ]);
      const ok = quickCheck === "ok" && foreignKeyViolations === 0;
      await this.backupRuns.finish(run.id, {
        status: ok ? "succeeded" : "failed",
        error: ok ? null : `quick_check=${quickCheck}; fk_violations=${foreignKeyViolations}`,
        metadata: { quickCheck, foreignKeyViolations },
      });
      return { ok, quickCheck, foreignKeyViolations, runId: run.id };
    } catch (err) {
      await this.backupRuns.finish(run.id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

async function timed(fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}
