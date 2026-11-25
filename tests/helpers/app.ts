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
