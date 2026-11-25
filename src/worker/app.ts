import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AppError } from "./lib/errors";
import { accessAuth, type AccessAuthOptions } from "./middleware/access-auth";
import { csrfProtection } from "./middleware/csrf";
import { apiNotFound, errorHandler } from "./middleware/error-handler";
import { appContext, requestId } from "./middleware/request-context";
import { securityHeaders } from "./middleware/security-headers";
import { inboxRoutes } from "./routes/inbox.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { systemRoutes } from "./routes/system.routes";
import type { AppEnv } from "./types";

export interface CreateAppOptions {
  auth?: AccessAuthOptions;
}

const JSON_BODY_LIMIT = 1024 * 1024; // 1 MiB; file uploads get their own limit (Phase 4)

/**
 * Request pipeline (order matters):
 *   requestId → securityHeaders (wraps everything, incl. errors)
 *   → appContext (config validation, services)
 *   → /api/health (unauthenticated liveness)
 *   → accessAuth (all other routes, API and static assets)
 *   → /api/*: csrf → body limit → routes → JSON 404
 *   → everything else: static assets / SPA fallback
 */
export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();

  app.use("*", requestId());
  app.use("*", securityHeaders());
  app.use("*", appContext());

  // Liveness only: reveals nothing beyond "the Worker runs".
  app.get("/api/health", (c) => c.json({ data: { status: "ok" } }));

  app.use("*", accessAuth(options.auth));

  const api = new Hono<AppEnv>();
  api.use("*", csrfProtection());
  api.use(
    "*",
    bodyLimit({
      maxSize: JSON_BODY_LIMIT,
      onError: () => {
        throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
      },
    }),
  );
  api.route("/", systemRoutes);
  api.route("/settings", settingsRoutes);
  api.route("/inbox", inboxRoutes);
  api.notFound(apiNotFound);
  app.route("/api", api);
  app.all("/api/*", apiNotFound);

  // Static assets + SPA fallback (configured in wrangler.jsonc `assets`).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError(errorHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;
