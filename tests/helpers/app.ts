import { env } from "cloudflare:workers";
import { createApp } from "../../src/worker/app";
import type { KeyResolverFactory } from "../../src/worker/auth/access-jwt";

export const ORIGIN = "https://brain.example.com";

/** Builds the real app with an injected JWKS and calls it in-process. */
export function makeClient(keyResolver: KeyResolverFactory, envOverrides: Partial<Record<string, unknown>> = {}) {
  const app = createApp({ auth: { keyResolver } });
  const testEnv = { ...env, ...envOverrides } as Env;
  return (path: string, init: RequestInit = {}, base = ORIGIN) =>
    app.request(new Request(`${base}${path}`, init), undefined, testEnv);
}

/** Authenticated JSON client for API tests (CSRF-compliant headers). */
export function makeApi(call: ReturnType<typeof makeClient>, token: string) {
  const req = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { "cf-access-jwt-assertion": token, "sec-fetch-site": "same-origin" };
    if (body !== undefined) headers["content-type"] = "application/json";
    return call(path, { method, headers, body: body === undefined ? null : JSON.stringify(body) });
  };
  /** Request that must succeed; returns `data`. */
  const ok = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await req(method, path, body);
    if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as { data: T }).data;
  };
  return { req, ok };
}
