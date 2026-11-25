import { Hono } from "hono";
import { z } from "../../shared/z";
import type { ApiSuccess, AuditLogEntry, IntegrityCheckResponse, MeResponse, SystemStatusResponse } from "../../shared/api";
import { requestMeta } from "../lib/request-meta";
import type { AppEnv } from "../types";

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const systemRoutes = new Hono<AppEnv>()
  .get("/me", (c) => {
    const identity = c.get("identity");
    const config = c.get("config");
    return c.json<ApiSuccess<MeResponse>>({
      data: {
        email: identity.email,
        authSource: identity.source,
        timezone: config.APP_TIMEZONE,
        environment: config.ENVIRONMENT,
      },
    });
  })
  .get("/system/status", async (c) => {
    const status = await c.get("services").system.status();
    return c.json<ApiSuccess<SystemStatusResponse>>({ data: status });
  })
  .post("/system/integrity-check", async (c) => {
    const services = c.get("services");
    const result = await services.system.integrityCheck();
    await services.audit.record(requestMeta(c), {
      action: "system.integrity_check",
      entityType: "backup_run",
      entityId: result.runId,
      metadata: { ok: result.ok },
    });
    return c.json<ApiSuccess<IntegrityCheckResponse>>({ data: result });
  })
  .get("/audit-logs", async (c) => {
    const { limit } = auditQuerySchema.parse(c.req.query());
    const entries = await c.get("services").audit.listRecent(limit);
    return c.json<ApiSuccess<AuditLogEntry[]>>({ data: entries });
  });
