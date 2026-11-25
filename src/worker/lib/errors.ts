import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorCode } from "../../shared/api";

/** Expected, client-facing error. Anything else is treated as a 500. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "Authentication required") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "Access denied") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
export const badRequest = (message: string, details?: unknown) => new AppError(400, "VALIDATION_FAILED", message, details);

/** Row must exist and not be in the trash. */
export function assertLive<T extends { deletedAt: Date | null }>(row: T | undefined, label: string): T {
  if (!row || row.deletedAt) throw new AppError(404, "NOT_FOUND", `${label} não encontrado(a)`);
  return row;
}
