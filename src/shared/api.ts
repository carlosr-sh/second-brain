/** Wire types shared by the API (producer) and the SPA (consumer). */

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CSRF_REJECTED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export interface MeResponse {
  email: string;
  authSource: "access" | "dev";
  timezone: string;
  environment: string;
}

export interface CheckResult {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface SystemStatusResponse {
  version: string;
  environment: string;
  serverTime: string;
  checks: {
    database: CheckResult;
    storage: CheckResult;
  };
  migrations: string[];
}

export interface IntegrityCheckResponse {
  ok: boolean;
  quickCheck: string;
  foreignKeyViolations: number;
  runId: string;
}

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
}
