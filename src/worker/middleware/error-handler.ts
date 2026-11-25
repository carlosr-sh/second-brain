import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ApiErrorBody } from "../../shared/api";
import { ConfigError } from "../config";
import { AppError } from "../lib/errors";
import { isApiPath } from "../lib/request-meta";
import type { AppEnv } from "../types";

/**
 * Converts every thrown error into a consistent response. Internal details
 * (stack traces, SQL, config values) are logged, never returned.
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId");
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = new AppError(400, "VALIDATION_FAILED", "Request validation failed", err.issues);
  } else if (err instanceof HTTPException) {
    appError =
      err.status === 413
        ? new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large")
        : new AppError(err.status === 400 ? 400 : 500, err.status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR", err.status === 400 ? "Bad request" : "Unexpected error");
  } else if (constraintKind(err)) {
    const kind = constraintKind(err);
    appError =
      kind === "check"
        ? new AppError(400, "VALIDATION_FAILED", "Os dados violam uma regra de integridade")
        : new AppError(409, "CONFLICT", kind === "fk" ? "Registro relacionado inexistente ou em uso" : "Registro duplicado");
    console.warn(JSON.stringify({ event: "db.constraint", kind, requestId }));
  } else if (err instanceof ConfigError) {
    console.error(JSON.stringify({ event: "config.invalid", issues: err.issues, requestId }));
    appError = new AppError(500, "CONFIGURATION_ERROR", "Server is not configured correctly");
  } else {
    console.error(JSON.stringify({ event: "unhandled_error", requestId, name: (err as Error)?.name, message: (err as Error)?.message, stack: (err as Error)?.stack }));
    appError = new AppError(500, "INTERNAL_ERROR", "Unexpected error");
  }

  if (!isApiPath(c.req.path)) {
    // Browser navigation: plain, dependency-free page (no SPA bundle involved).
    return c.html(
      `<!doctype html><meta charset="utf-8"><title>${appError.status}</title><p>${escapeHtml(appError.message)}</p><p><small>Request ID: ${escapeHtml(requestId ?? "-")}</small></p>`,
      appError.status,
    );
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(requestId ? { requestId } : {}),
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };
  return c.json(body, appError.status);
};

export const apiNotFound: NotFoundHandler<AppEnv> = (c) => {
  const body: ApiErrorBody = { error: { code: "NOT_FOUND", message: "Route not found", requestId: c.get("requestId") } };
  return c.json(body, 404);
};

/** SQLite constraint violations surfaced by D1 (possibly wrapped by Drizzle in `cause`). */
function constraintKind(err: unknown): "fk" | "check" | "unique" | null {
  for (let e: unknown = err, depth = 0; e instanceof Error && depth < 4; e = e.cause, depth++) {
    const m = e.message;
    if (m.includes("FOREIGN KEY constraint failed")) return "fk";
    if (m.includes("CHECK constraint failed")) return "check";
    if (m.includes("UNIQUE constraint failed")) return "unique";
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
