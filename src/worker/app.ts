import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AppError } from "./lib/errors";
import { accessAuth, type AccessAuthOptions } from "./middleware/access-auth";
import { csrfProtection } from "./middleware/csrf";
import { apiNotFound, errorHandler } from "./middleware/error-handler";
import { appContext, requestId } from "./middleware/request-context";
import { securityHeaders } from "./middleware/security-headers";
import { inboxRoutes } from "./routes/inbox.routes";
import { bookmarkRoutes, bookRoutes, fileRoutes, inboxToNoteRoutes, notebookRoutes, noteRoutes, resourceRoutes, searchRoutes, tagAssignRoutes, tagRoutes } from "./routes/knowledge.routes";
import { accountRoutes, categoryRoutes, contactRoutes, financeReportRoutes, habitRoutes, journalByIdRoutes, journalRoutes, transactionRoutes } from "./routes/personal.routes";
import { areaRoutes, goalRoutes, inboxConvertRoutes, projectRoutes, taskRoutes, trashRoutes } from "./routes/para.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { systemRoutes } from "./routes/system.routes";
import type { AppEnv } from "./types";
import { MAX_UPLOAD_BYTES } from "../shared/knowledge";

/** Only same-origin absolute paths ("/x"); never "//evil.com" or "/\\evil.com" (open redirect). */
export function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\u0000-\u001f]/.test(next)) return "/";
  return next;
}

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
  const tooLarge = () => {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  };
  const jsonLimit = bodyLimit({ maxSize: JSON_BODY_LIMIT, onError: tooLarge });
  const uploadLimit = bodyLimit({ maxSize: MAX_UPLOAD_BYTES + 64 * 1024, onError: tooLarge }); // + multipart overhead
  api.use("*", (c, next) => (c.req.method === "POST" && c.req.path === "/api/files" ? uploadLimit(c, next) : jsonLimit(c, next)));
  api.route("/", systemRoutes);
  api.route("/settings", settingsRoutes);
  api.route("/inbox", inboxRoutes);
  api.route("/inbox", inboxConvertRoutes);
  api.route("/inbox", inboxToNoteRoutes);
  api.route("/areas", areaRoutes);
  api.route("/goals", goalRoutes);
  api.route("/projects", projectRoutes);
  api.route("/tasks", taskRoutes);
  api.route("/trash", trashRoutes);
  api.route("/notes", noteRoutes);
  api.route("/notebooks", notebookRoutes);
  api.route("/resources", resourceRoutes);
  api.route("/tags", tagRoutes);
  api.route("/bookmarks", bookmarkRoutes);
  api.route("/books", bookRoutes);
  api.route("/search", searchRoutes);
  api.route("/files", fileRoutes);
  api.route("/accounts", accountRoutes);
  api.route("/categories", categoryRoutes);
  api.route("/transactions", transactionRoutes);
  api.route("/finance", financeReportRoutes);
  api.route("/habits", habitRoutes);
  api.route("/journal", journalRoutes);
  api.route("/journals", journalByIdRoutes);
  api.route("/contacts", contactRoutes);
  api.route("/", tagAssignRoutes);
  api.notFound(apiNotFound);
  app.route("/api", api);
  app.all("/api/*", apiNotFound);

  /**
   * Re-login hop for the PWA. The service worker answers every navigation
   * from its cache, so a plain reload would never reach Cloudflare Access.
   * /auth/* is excluded from the SW fallback: this request hits the network,
   * Access sends an expired session through its login, and once the request
   * gets here (authenticated) we bounce back to the page the user was on.
   */
  app.get("/auth/login", (c) => c.redirect(safeNextPath(c.req.query("next")), 302));

  // Static assets + SPA fallback (configured in wrangler.jsonc `assets`).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError(errorHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;
