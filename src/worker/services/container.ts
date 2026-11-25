import { createDb, type Database } from "../db/client";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { BackupRunRepository } from "../repositories/backup-run.repository";
import { InboxRepository } from "../repositories/inbox.repository";
import { SettingsRepository } from "../repositories/settings.repository";
import { SystemRepository } from "../repositories/system.repository";
import { AuditService } from "./audit.service";
import { InboxService } from "./inbox.service";
import { SettingsService } from "./settings.service";
import { SystemService } from "./system.service";

/**
 * Composition root: wires repositories into services for one request.
 * Routes depend on services only; services depend on repositories only.
 */
export interface Services {
  db: Database;
  audit: AuditService;
  system: SystemService;
  settings: SettingsService;
  inbox: InboxService;
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
    settings: new SettingsService(new SettingsRepository(db)),
    inbox: new InboxService(new InboxRepository(db)),
  };
}
