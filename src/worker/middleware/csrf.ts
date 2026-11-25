import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_CONTENT_TYPES = ["application/json", "multipart/form-data"];

/**
 * CSRF protection for state-changing API requests.
 *
 * Cloudflare Access authenticates the browser through a cookie
 * (CF_Authorization), so a malicious site could try to make the browser send
 * a cross-site request carrying that cookie. We reject it unless:
 *  - `Sec-Fetch-Site` is `same-origin` (modern browsers always send it), or,
 *    when absent, `Origin` matches the request's own origin; AND
 *  - the body uses a content type a plain HTML form cannot produce
 *    cross-origin without a CORS preflight (`application/json`), or multipart
 *    (uploads), which is still subject to the origin check above.
 */
export const csrfProtection = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();

  const selfOrigin = new URL(c.req.url).origin;
  const fetchSite = c.req.header("sec-fetch-site");
  const origin = c.req.header("origin");

  const sameOrigin = fetchSite ? fetchSite === "same-origin" : origin === selfOrigin;
  if (!sameOrigin) {
    throw new AppError(403, "CSRF_REJECTED", "Cross-site request rejected");
  }

  const hasBody = c.req.header("content-length") !== "0" && c.req.raw.body !== null;
  if (hasBody) {
    const contentType = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported content type");
    }
  }
  return next();
};
