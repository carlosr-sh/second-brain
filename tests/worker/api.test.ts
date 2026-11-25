import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../../src/shared/api";
import { createFakeAccess, OWNER } from "../helpers/access";
import { makeClient, ORIGIN } from "../helpers/app";

let fake: Awaited<ReturnType<typeof createFakeAccess>>;
let call: ReturnType<typeof makeClient>;
let ownerToken: string;

beforeAll(async () => {
  fake = await createFakeAccess();
  call = makeClient(fake.keyResolver);
  ownerToken = await fake.sign();
});

const auth = (token = ownerToken, extra: Record<string, string> = {}) => ({
  "cf-access-jwt-assertion": token,
  ...extra,
});
const errorCode = async (res: Response) => ((await res.json()) as ApiErrorBody).error.code;

describe("authentication", () => {
  it("serves the liveness probe without authentication", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" } });
  });

  it("rejects API requests without an Access token (401)", async () => {
    const res = await call("/api/me");
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("rejects static asset / page requests without a token (401 HTML)", async () => {
    const res = await call("/");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("rejects an invalid token (401)", async () => {
    const res = await call("/api/me", { headers: auth(await fake.sign({}, { audience: "wrong" })) });
    expect(res.status).toBe(401);
  });

  it("rejects a valid token for a different user (403) and audits it", async () => {
    const intruder = await fake.sign({ email: "intruder@example.com" });
    const res = await call("/api/me", { headers: auth(intruder) });
    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("FORBIDDEN");

    const row = await env.DB.prepare("select action, actor_email from audit_logs where request_id = ?")
      .bind(body.error.requestId)
      .first<{ action: string; actor_email: string }>();
    expect(row).toEqual({ action: "auth.forbidden_identity", actor_email: "intruder@example.com" });
  });

  it("returns the owner identity for a valid token", async () => {
    const res = await call("/api/me", { headers: auth() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { email: OWNER, authSource: "access", timezone: "America/Recife", environment: "test" },
    });
  });

  it("dev bypass works only with ENVIRONMENT=development on localhost", async () => {
    const devCall = makeClient(fake.keyResolver, { ENVIRONMENT: "development", DEV_AUTH_EMAIL: OWNER });
    const local = await devCall("/api/me", {}, "http://localhost:5173");
    expect(local.status).toBe(200);
    expect(((await local.json()) as { data: { authSource: string } }).data.authSource).toBe("dev");

    // Same dev env but a public hostname: bypass must NOT apply.
    expect((await devCall("/api/me", {}, ORIGIN)).status).toBe(401);

    // Production env on localhost: bypass must NOT apply.
    const prodCall = makeClient(fake.keyResolver, { ENVIRONMENT: "production", DEV_AUTH_EMAIL: OWNER });
    expect((await prodCall("/api/me", {}, "http://localhost:5173")).status).toBe(401);
  });

  it("fails closed when configuration is invalid", async () => {
    const broken = makeClient(fake.keyResolver, { OWNER_EMAIL: "" });
    const res = await broken("/api/me", { headers: auth() });
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("CONFIGURATION_ERROR");
    expect(JSON.stringify(body)).not.toContain("example.com");
  });
});

describe("CSRF protection", () => {
  const post = (headers: Record<string, string>, body: BodyInit | null = "{}") =>
    call("/api/system/integrity-check", { method: "POST", headers: auth(ownerToken, headers), body });

  it("rejects cross-site requests", async () => {
    const res = await post({ "sec-fetch-site": "cross-site", "content-type": "application/json" });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("CSRF_REJECTED");
  });

  it("rejects a foreign Origin when Sec-Fetch-Site is absent", async () => {
    const res = await post({ origin: "https://evil.example", "content-type": "application/json" });
    expect(res.status).toBe(403);
  });

  it("rejects requests with neither Sec-Fetch-Site nor Origin", async () => {
    expect((await post({ "content-type": "application/json" })).status).toBe(403);
  });

  it("rejects form-encoded bodies even from same origin (415)", async () => {
    const res = await post({ "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" }, "a=1");
    expect(res.status).toBe(415);
  });

  it("accepts same-origin JSON requests", async () => {
    const res = await post({ "sec-fetch-site": "same-origin", "content-type": "application/json" });
    expect(res.status).toBe(200);
  });

  it("accepts matching Origin when Sec-Fetch-Site is absent", async () => {
    const res = await post({ origin: ORIGIN, "content-type": "application/json" });
    expect(res.status).toBe(200);
  });
});

describe("system endpoints", () => {
  it("reports database and storage health plus applied migrations", async () => {
    const res = await call("/api/system/status", { headers: auth() });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { checks: Record<string, { ok: boolean }>; migrations: string[] } };
    expect(data.checks.database?.ok).toBe(true);
    expect(data.checks.storage?.ok).toBe(true);
    expect(data.migrations).toContain("0000_initial_schema.sql");
  });

  it("runs an integrity check, logs the run and audits it", async () => {
    const res = await call("/api/system/integrity-check", {
      method: "POST",
      headers: auth(ownerToken, { "sec-fetch-site": "same-origin", "content-type": "application/json" }),
      body: "{}",
    });
    const { data } = (await res.json()) as { data: { ok: boolean; runId: string; quickCheck: string } };
    expect(data).toMatchObject({ ok: true, quickCheck: "ok", foreignKeyViolations: 0 });

    const run = await env.DB.prepare("select kind, status, finished_at from backup_runs where id = ?").bind(data.runId).first();
    expect(run).toMatchObject({ kind: "integrity_check", status: "succeeded" });
    expect(run?.finished_at).toBeTypeOf("number");

    const logs = await call("/api/audit-logs?limit=10", { headers: auth() });
    const { data: entries } = (await logs.json()) as { data: { action: string; entityId: string; actorEmail: string }[] };
    expect(entries.find((e) => e.entityId === data.runId)).toMatchObject({
      action: "system.integrity_check",
      actorEmail: OWNER,
    });
  });

  it("validates query parameters (400)", async () => {
    const res = await call("/api/audit-logs?limit=9999", { headers: auth() });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("VALIDATION_FAILED");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await call("/api/does-not-exist", { headers: auth() });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("NOT_FOUND");
  });

  it("rejects oversized JSON bodies (413)", async () => {
    const res = await call("/api/system/integrity-check", {
      method: "POST",
      headers: auth(ownerToken, { "sec-fetch-site": "same-origin", "content-type": "application/json" }),
      body: JSON.stringify({ x: "a".repeat(1024 * 1024 + 10) }),
    });
    expect(res.status).toBe(413);
  });
});

describe("security headers", () => {
  it("applies a strict CSP and hardening headers to API responses", async () => {
    const res = await call("/api/me", { headers: auth() });
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("applies headers to error responses too", async () => {
    const res = await call("/api/me");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });
});
