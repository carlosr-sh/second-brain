import type { MiddlewareHandler } from "hono";
import { isApiPath } from "../lib/request-meta";
import type { AppEnv } from "../types";

/**
 * Content Security Policy. Production is strict: no inline scripts, no eval,
 * no third-party origins. `style-src 'unsafe-inline'` is required by the rich
 * text editor / UI primitives, which set inline `style` attributes.
 */
export function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": isDev ? ["'self'", "ws:", "wss:"] : ["'self'"],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

const STATIC_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** Applies security headers to EVERY response (API and static assets). */
export const securityHeaders = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  await next();

  const isDev = c.get("config")?.ENVIRONMENT === "development";
  // Responses coming from fetch()/ASSETS have immutable headers: clone first.
  const res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(STATIC_HEADERS)) res.headers.set(k, v);
  res.headers.set("Content-Security-Policy", buildCsp(isDev));
  if (!isDev) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  if (isApiPath(c.req.path)) res.headers.set("Cache-Control", "no-store");
  const requestId = c.get("requestId");
  if (requestId) res.headers.set("X-Request-Id", requestId);
  c.res = res;
};
