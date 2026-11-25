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

/**
 * Thin fetch wrapper. Same-origin only; the Cloudflare Access cookie is sent
 * automatically. JSON bodies keep requests compatible with the CSRF policy.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
  const body = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiErrorBody | null;
  if (!res.ok || !body || !("data" in body)) {
    throw new ApiError(res.status, body && "error" in body ? body : null);
  }
  return body.data;
}
