import type { MiddlewareHandler } from "hono";
import {
  ACCESS_JWT_HEADER,
  AccessTokenError,
  remoteKeyResolver,
  verifyAccessJwt,
  type KeyResolverFactory,
} from "../auth/access-jwt";
import { forbidden, unauthenticated } from "../lib/errors";
import { requestMeta } from "../lib/request-meta";
import type { AppEnv } from "../types";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface AccessAuthOptions {
  /** Injectable for tests; defaults to the team's remote JWKS endpoint. */
  keyResolver?: KeyResolverFactory;
}

/**
 * Authenticates the single owner.
 *
 * 1. Local development bypass — ONLY if ENVIRONMENT=development AND the
 *    request targets localhost AND DEV_AUTH_EMAIL is set. In production the
 *    ENVIRONMENT var is "production" (wrangler.jsonc) and the host is the
 *    custom domain, so both guards fail independently.
 * 2. Otherwise the Cloudflare Access JWT must be present and valid.
 * 3. The authenticated email must equal OWNER_EMAIL (single-user app).
 */
export const accessAuth =
  (options: AccessAuthOptions = {}): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const config = c.get("config");
    const hostname = new URL(c.req.url).hostname;

    let email: string;
    let source: "access" | "dev";

    if (config.ENVIRONMENT === "development" && LOCAL_HOSTS.has(hostname) && config.DEV_AUTH_EMAIL) {
      email = config.DEV_AUTH_EMAIL;
      source = "dev";
    } else {
      const token = c.req.header(ACCESS_JWT_HEADER);
      if (!token) throw unauthenticated("Missing Cloudflare Access token");
      try {
        const identity = await verifyAccessJwt(token, {
          teamDomain: config.ACCESS_TEAM_DOMAIN,
          audience: config.ACCESS_AUD,
          getKey: (options.keyResolver ?? remoteKeyResolver)(config.ACCESS_TEAM_DOMAIN),
        });
        email = identity.email;
        source = "access";
      } catch (err) {
        if (err instanceof AccessTokenError) {
          console.warn(JSON.stringify({ event: "auth.invalid_token", reason: err.reason, requestId: c.get("requestId") }));
          throw unauthenticated("Invalid Cloudflare Access token");
        }
        throw err;
      }
    }

    if (email !== config.OWNER_EMAIL) {
      // A validly-signed token for someone else means the Access policy is
      // broader than intended: record it durably.
      await c.get("services").audit.record(
        { ...requestMeta(c), actorEmail: email },
        { action: "auth.forbidden_identity", metadata: { source, path: c.req.path } },
      );
      throw forbidden("This account is not authorized to use this application");
    }

    c.set("identity", { email, source });
    await next();
  };
