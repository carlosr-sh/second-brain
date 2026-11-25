/**
 * Verifies the PRODUCTION build under the PRODUCTION Content Security Policy.
 *
 * Dev mode relaxes the CSP (Vite HMR needs inline scripts), so CSP bugs only
 * show up in production. This script:
 *  1. obtains the CSP header from the built Worker itself (dist/second_brain),
 *  2. serves dist/client with that header and a stubbed API,
 *  3. visits key pages in Chromium and fails on any CSP violation or error,
 *  4. PWA (Phase 7): service worker active, manifest + icons valid, no
 *     installability errors, airplane-mode reload shows saved data read-only,
 *     the SW never answers /api, and "Limpar dados offline" empties IndexedDB.
 * Usage: pnpm build && pnpm test:csp
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("dist/client");
const worker = await import(path.resolve("dist/second_brain/index.js"));
const env = {
  ENVIRONMENT: "production", APP_TIMEZONE: "America/Recife", OWNER_EMAIL: "o@example.com",
  ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud-0123456789abcdef", DB: {}, FILES: {}, ASSETS: {},
};
const health = await worker.default.fetch(new Request("https://brain.example.com/api/health"), env, { waitUntil() {}, passThroughOnException() {} });
const csp = health.headers.get("content-security-policy");
if (!csp || !csp.includes("script-src 'self'") || csp.includes("unsafe-inline' ws:")) {
  console.error("Could not obtain the production CSP from the built Worker:", csp);
  process.exit(1);
}

const now = new Date().toISOString();
const stub = {
  "/api/settings": { "appearance.theme": "dark", "layout.sidebarCollapsed": false },
  "/api/me": { email: "owner@example.com", authSource: "access", timezone: "America/Recife", environment: "production" },
  "/api/inbox/count": { open: 1 },
  "/api/inbox?status=open": [{ id: "0190a0a0-0000-7000-8000-000000000001", content: "Item", url: null, processedAt: null, createdAt: now }],
  "/api/system/status": { version: "0.0.0", environment: "production", serverTime: now, checks: { database: { ok: true, latencyMs: 1 }, storage: { ok: true, latencyMs: 1 } }, migrations: [] },
  "/api/audit-logs?limit=20": [],
  // Data so the finance charts actually draw bars/lines (Recharts) under the CSP.
  "/api/accounts?archived=false": [{ id: "0190a0a0-0000-7000-8000-0000000000c1", name: "Conta", type: "checking", currency: "BRL", institution: null, openingBalanceCents: 0, balanceCents: 123456, clearedBalanceCents: 123456, transactionCount: 2, archivedAt: null }],
  "/api/finance/summary?months=12": [{ month: "2026-10", incomeCents: 500000, expenseCents: 120000, netCents: 380000 }, { month: "2026-11", incomeCents: 450000, expenseCents: 200000, netCents: 250000 }],
  // A real note so the rich-text editor (Tiptap/ProseMirror) actually mounts.
  "/api/notes/0190a0a0-0000-7000-8000-0000000000aa": {
    id: "0190a0a0-0000-7000-8000-0000000000aa", title: "Nota", excerpt: "", notebookId: null, projectId: null, areaId: null, resourceId: null,
    isPinned: false, isFavorite: false, tagIds: [], archivedAt: null, createdAt: now, updatedAt: now, wordCount: 2,
    content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Olá" }] },
      { type: "paragraph", content: [{ type: "text", text: "mundo", marks: [{ type: "bold" }] }, { type: "noteLink", attrs: { id: "0190a0a0-0000-7000-8000-0000000000bb", label: "outra" } }] }] },
  },
};
const types = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  res.setHeader("Content-Security-Policy", csp);
  if (req.url.startsWith("/api/")) {
    res.setHeader("content-type", "application/json");
    const listLike = /^\/api\/(tasks|projects|areas|goals|trash|notes|notebooks|tags|resources|bookmarks|books|search|accounts|categories|transactions|habits|contacts|journal)(\?|$)|\/backlinks$|^\/api\/finance\/(by-category|balance)/.test(req.url);
    if (req.url.startsWith("/api/finance/by-category")) return res.end(JSON.stringify({ data: [{ categoryId: null, name: "Moradia", totalCents: 150000 }, { categoryId: null, name: "Mercado", totalCents: 50000 }] }));
    if (req.url.startsWith("/api/finance/balance")) return res.end(JSON.stringify({ data: [{ date: "2026-11-01", balanceCents: 100000 }, { date: "2026-11-25", balanceCents: 123456 }] }));
    return res.end(JSON.stringify({ data: stub[req.url] ?? (listLike ? [] : null) }));
  }
  let file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const problems = [];
try {
  const page = await browser.newPage();
  let route = "(start)";
  page.on("console", (m) => m.type() === "error" && problems.push(`[${route}] ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`[${route}] ${e.message}`));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)),
  );
  for (const r of ["/", "/inbox", "/settings", "/tasks", "/tasks?view=board", "/tasks?view=calendar", "/tasks?view=table", "/projects", "/areas", "/goals", "/archive", "/archive?tab=trash", "/notes", "/notes/0190a0a0-0000-7000-8000-0000000000aa", "/notebooks", "/tags", "/resources", "/bookmarks", "/bookshelf", "/finance", "/finance?tab=transactions", "/finance?tab=accounts", "/finance?tab=categories", "/habits", "/journal/2026-11-20", "/contacts", "/nao-existe"]) {
    route = r;
    await page.goto(base + r, { waitUntil: "networkidle" });
  }
  // Charts must actually draw, otherwise this proves nothing about Recharts.
  route = "/finance (charts check)";
  await page.goto(base + "/finance", { waitUntil: "networkidle" });
  if (!(await page.locator(".recharts-bar-rectangle").count())) problems.push("finance charts did not render (check is not exercising Recharts)");
  // The editor must actually be mounted, otherwise this check proves nothing about Tiptap.
  route = "/notes/:id (editor check)";
  await page.goto(base + "/notes/0190a0a0-0000-7000-8000-0000000000aa", { waitUntil: "networkidle" });
  const editorMounted = await page.locator(".ProseMirror h2", { hasText: "Olá" }).count();
  if (!editorMounted) problems.push("rich-text editor did not mount (check is not exercising Tiptap)");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(" teste");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("ola");
  await page.waitForTimeout(400);

  await verifyPwa();
} finally {
  await browser.close();
  server.close();
}

async function verifyPwa() {
  const context = await browser.newContext();
  const page = await context.newPage();
  let route = "PWA";
  // Offline, Chromium logs every failed attempt (health probe, revalidation):
  // expected there, and only there.
  const expectedOffline = (text) => route === "PWA: offline" && text.includes("net::ERR_INTERNET_DISCONNECTED");
  page.on("console", (m) => m.type() === "error" && !expectedOffline(m.text()) && problems.push(`[${route}] ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`[${route}] ${e.message}`));
  const swApi = [];
  page.on("response", (r) => r.fromServiceWorker() && new URL(r.url()).pathname.startsWith("/api/") && swApi.push(r.url()));

  // 1. Service worker installs, activates and controls the page.
  route = "PWA: service worker";
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) problems.push("service worker is not controlling the page");

  // 2. Manifest and icons.
  route = "PWA: manifest";
  const manifest = await page.evaluate(() => fetch("/manifest.webmanifest", { credentials: "include" }).then((r) => r.json()));
  if (manifest.display !== "standalone" || manifest.start_url !== "/") problems.push(`manifest: unexpected ${manifest.display} / ${manifest.start_url}`);
  if (!manifest.icons.some((i) => i.purpose === "maskable")) problems.push("manifest: no maskable icon");
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const info = await page.evaluate(async (src) => {
      const r = await fetch(src);
      const bmp = await createImageBitmap(await r.blob());
      return { ok: r.ok, type: r.headers.get("content-type"), size: `${bmp.width}x${bmp.height}` };
    }, icon.src);
    if (!info.ok || info.type !== "image/png" || info.size !== icon.sizes) problems.push(`icon ${icon.src}: ${JSON.stringify(info)}`);
  }
  if (!(await page.locator('link[rel="manifest"][crossorigin="use-credentials"]').count())) problems.push("manifest link must send credentials (Cloudflare Access)");

  // 3. Chromium's own installability verdict.
  route = "PWA: installability";
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  if (installabilityErrors.length) problems.push(`not installable: ${JSON.stringify(installabilityErrors)}`);

  // 4. Visit pages online (they get persisted), then airplane mode.
  route = "PWA: warm-up";
  // ~1.5 s on each screen (someone reading it): longer than the 1 s persister throttle.
  for (const r of ["/notes/0190a0a0-0000-7000-8000-0000000000aa", "/finance"]) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);
  }
  route = "PWA: offline";
  await context.setOffline(true);
  await page.goto(base + "/notes/0190a0a0-0000-7000-8000-0000000000aa");
  await page.locator(".ProseMirror h2", { hasText: "Olá" }).waitFor({ timeout: 10_000 }).catch(() => problems.push("offline: saved note did not render"));
  if (!(await page.getByRole("status").filter({ hasText: "Sem conexão" }).count())) problems.push("offline: banner missing");
  if ((await page.locator(".ProseMirror").getAttribute("contenteditable", { timeout: 2_000 }).catch(() => null)) !== "false") problems.push("offline: editor is still editable");
  await page.goto(base + "/finance");
  await page.getByText("1.234,56").first().waitFor({ timeout: 10_000 }).catch(() => problems.push("offline: saved finance data did not render"));
  await context.setOffline(false);
  if (swApi.length) problems.push(`service worker answered API requests: ${swApi.join(", ")}`);

  // 5. "Limpar dados offline" really empties IndexedDB.
  route = "PWA: clear";
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Limpar dados offline" }).click();
  await page.waitForEvent("load");
  await page.waitForTimeout(300);
  const left = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("second-brain-offline");
        req.onsuccess = () => {
          const tx = req.result.transaction("query-cache", "readonly").objectStore("query-cache").count();
          tx.onsuccess = () => resolve(tx.result);
        };
      }),
  );
  // The settings page itself may re-persist a few queries right after reload;
  // what must be gone is the note and finance data cached before.
  const stillHasNote = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("second-brain-offline");
        req.onsuccess = () => {
          const g = req.result.transaction("query-cache", "readonly").objectStore("query-cache").get("sb-query-cache");
          g.onsuccess = () => resolve(typeof g.result === "string" && g.result.includes("0190a0a0-0000-7000-8000-0000000000aa"));
        };
      }),
  );
  if (stillHasNote) problems.push(`clear: offline copy still holds the note (entries: ${left})`);
  await context.close();
}

if (problems.length) {
  console.error("FAIL — production CSP problems:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log("OK — production build runs under the production CSP with no violations; PWA installable, offline read and data wipe verified.");
