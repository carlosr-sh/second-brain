import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../../src/shared/api";
import type { InboxItem } from "../../src/shared/inbox";
import type { Settings } from "../../src/shared/settings";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";
import { createFakeAccess } from "../helpers/access";
import { makeClient } from "../helpers/app";

let call: ReturnType<typeof makeClient>;
let token: string;

beforeAll(async () => {
  const fake = await createFakeAccess();
  call = makeClient(fake.keyResolver);
  token = await fake.sign();
});

function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "cf-access-jwt-assertion": token, "sec-fetch-site": "same-origin" };
  if (body !== undefined) headers["content-type"] = "application/json";
  return call(path, { method, headers, body: body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body) });
}
const json = async <T>(res: Response) => ((await res.json()) as { data: T }).data;
const code = async (res: Response) => ((await res.json()) as ApiErrorBody).error.code;

describe("settings API", () => {
  beforeEach(async () => {
    await env.DB.prepare("delete from settings").run();
  });

  it("returns defaults when nothing is stored", async () => {
    expect(await json<Settings>(await req("GET", "/api/settings"))).toEqual(DEFAULT_SETTINGS);
  });

  it("persists a valid value and returns the merged settings", async () => {
    const res = await req("PUT", "/api/settings/appearance.theme", { value: "dark" });
    expect(res.status).toBe(200);
    expect((await json<Settings>(res))["appearance.theme"]).toBe("dark");
    expect((await json<Settings>(await req("GET", "/api/settings")))["appearance.theme"]).toBe("dark");
    // upsert: a second write updates the same row
    await req("PUT", "/api/settings/appearance.theme", { value: "light" });
    const rows = await env.DB.prepare("select value from settings where key = 'appearance.theme'").all();
    expect(rows.results).toEqual([{ value: '"light"' }]);
  });

  it("rejects invalid values (400) and unknown keys (404)", async () => {
    const bad = await req("PUT", "/api/settings/appearance.theme", { value: "neon" });
    expect(bad.status).toBe(400);
    expect(await code(bad)).toBe("VALIDATION_FAILED");
    expect((await req("PUT", "/api/settings/__proto__", { value: 1 })).status).toBe(404);
    expect((await req("PUT", "/api/settings/hacker.key", { value: 1 })).status).toBe(404);
  });

  it("falls back to the default when a stored value became invalid", async () => {
    await env.DB.prepare("insert into settings (key, value) values ('layout.sidebarCollapsed', '\"yes\"')").run();
    expect((await json<Settings>(await req("GET", "/api/settings")))["layout.sidebarCollapsed"]).toBe(false);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await req("PUT", "/api/settings/appearance.theme", "{not json");
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("BAD_REQUEST");
  });
});

describe("inbox API", () => {
  beforeEach(async () => {
    await env.DB.prepare("delete from inbox_items").run();
  });

  it("captures, lists and counts open items (newest first)", async () => {
    const first = await req("POST", "/api/inbox", { content: "  Ideia: artigo sobre PARA  " });
    expect(first.status).toBe(201);
    expect((await json<InboxItem>(first)).content).toBe("Ideia: artigo sobre PARA"); // trimmed
    await req("POST", "/api/inbox", { content: "Ler depois", url: "https://example.com/post" });

    const list = await json<InboxItem[]>(await req("GET", "/api/inbox"));
    expect(list.map((i) => i.content)).toEqual(["Ler depois", "Ideia: artigo sobre PARA"]);
    expect(list[0]?.url).toBe("https://example.com/post");
    expect(await json<{ open: number }>(await req("GET", "/api/inbox/count"))).toEqual({ open: 2 });
  });

  it("validates input: empty content and non-http URLs are rejected", async () => {
    expect((await req("POST", "/api/inbox", { content: "   " })).status).toBe(400);
    expect((await req("POST", "/api/inbox", { content: "x", url: "javascript:alert(1)" })).status).toBe(400);
    expect((await req("POST", "/api/inbox", { content: "x", url: "data:text/html,hi" })).status).toBe(400);
    expect((await req("POST", "/api/inbox", { content: "a".repeat(10_001) })).status).toBe(400);
  });

  it("marks items processed / reopens them and filters by status", async () => {
    const item = await json<InboxItem>(await req("POST", "/api/inbox", { content: "Processar" }));
    const processed = await json<InboxItem>(await req("PATCH", `/api/inbox/${item.id}`, { processed: true }));
    expect(processed.processedAt).not.toBeNull();
    expect(await json<InboxItem[]>(await req("GET", "/api/inbox?status=open"))).toHaveLength(0);
    expect(await json<InboxItem[]>(await req("GET", "/api/inbox?status=processed"))).toHaveLength(1);

    const reopened = await json<InboxItem>(await req("PATCH", `/api/inbox/${item.id}`, { processed: false }));
    expect(reopened.processedAt).toBeNull();
  });

  it("soft-deletes items (row kept with deleted_at, hidden from lists)", async () => {
    const item = await json<InboxItem>(await req("POST", "/api/inbox", { content: "Lixo" }));
    expect((await req("DELETE", `/api/inbox/${item.id}`)).status).toBe(204);
    expect(await json<InboxItem[]>(await req("GET", "/api/inbox?status=all"))).toHaveLength(0);
    const row = await env.DB.prepare("select deleted_at from inbox_items where id = ?").bind(item.id).first<{ deleted_at: number }>();
    expect(row?.deleted_at).toBeTypeOf("number");
    // already deleted → 404
    expect((await req("DELETE", `/api/inbox/${item.id}`)).status).toBe(404);
    expect((await req("PATCH", `/api/inbox/${item.id}`, { processed: true })).status).toBe(404);
  });

  it("returns 404 for malformed ids without touching the database", async () => {
    expect((await req("DELETE", "/api/inbox/not-a-uuid")).status).toBe(404);
  });

  it("requires CSRF-safe requests for mutations", async () => {
    const res = await call("/api/inbox", {
      method: "POST",
      headers: { "cf-access-jwt-assertion": token, "sec-fetch-site": "cross-site", "content-type": "application/json" },
      body: JSON.stringify({ content: "x" }),
    });
    expect(res.status).toBe(403);
  });
});
