import type { ApiErrorBody, ApiSuccess } from "@shared/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.error.message ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

/** Thrown when the Cloudflare Access session is gone (redirect to login or 401). */
export class SessionExpiredError extends Error {
  constructor() {
    super("Sua sessão expirou");
    this.name = "SessionExpiredError";
  }
}

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();
export function onSessionExpired(fn: SessionListener): () => void {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
}

/**
 * Thin fetch wrapper for the same-origin API.
 *  - JSON bodies (keeps requests compatible with the CSRF policy).
 *  - `redirect: "manual"`: when the Access session expires, Access answers
 *    with a redirect to its login domain. Following it cross-origin would
 *    surface as an opaque CORS TypeError; instead we detect it explicitly.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
    redirect: "manual",
  });

  if (res.type === "opaqueredirect" || res.status === 401) {
    sessionListeners.forEach((fn) => fn());
    throw new SessionExpiredError();
  }
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiErrorBody | null;
  if (!res.ok || !body || !("data" in body)) {
    throw new ApiError(res.status, body && "error" in body ? body : null);
  }
  return body.data;
}
