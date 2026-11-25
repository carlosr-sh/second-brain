import type { AuditLogEntry } from "../../shared/api";
import type { AuditLogRepository, AuditLogRow } from "../repositories/audit-log.repository";

/** Who/where context attached to every audit entry. */
export interface RequestMeta {
  actorEmail: string | null;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditEvent {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const MAX_USER_AGENT = 512;

export class AuditService {
  constructor(private readonly repo: AuditLogRepository) {}

  async record(meta: RequestMeta, event: AuditEvent): Promise<void> {
    await this.repo.insert({
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? null,
      actorEmail: meta.actorEmail,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, MAX_USER_AGENT) ?? null,
    });
  }

  async listRecent(limit: number): Promise<AuditLogEntry[]> {
    const rows = await this.repo.listRecent(limit);
    return rows.map(toDto);
  }
}

function toDto(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actorEmail: row.actorEmail,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    metadata: row.metadata ?? null,
  };
}
