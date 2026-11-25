import { createDb, type Database } from "../db/client";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { BackupRunRepository } from "../repositories/backup-run.repository";
import { SystemRepository } from "../repositories/system.repository";
import { AuditService } from "./audit.service";
import { SystemService } from "./system.service";

/**
 * Composition root: wires repositories into services for one request.
 * Routes depend on services only; services depend on repositories only.
 */
export interface Services {
  db: Database;
  audit: AuditService;
  system: SystemService;
}

export function createServices(env: Env, environment: string): Services {
  const db = createDb(env.DB);
  return {
    db,
    audit: new AuditService(new AuditLogRepository(db)),
    system: new SystemService(
      new SystemRepository(env.DB),
      new BackupRunRepository(db),
      env.FILES,
      environment,
    ),
  };
}
