/**
 * Verifies the PRODUCTION build under the PRODUCTION Content Security Policy.
 *
 * Dev mode relaxes the CSP (Vite HMR needs inline scripts), so CSP bugs only
 * show up in production. This script:
 *  1. obtains the CSP header from the built Worker itself (dist/second_brain),
 *  2. serves dist/client with that header and a stubbed API,
 *  3. visits key pages in Chromium and fails on any CSP violation or error.
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
};
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  res.setHeader("Content-Security-Policy", csp);
  if (req.url.startsWith("/api/")) {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ data: stub[req.url] ?? null }));
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
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(e.message));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)),
  );
  for (const route of ["/", "/inbox", "/settings", "/tasks", "/nao-existe"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
  }
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error("FAIL — production CSP problems:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log("OK — production build runs under the production CSP with no violations.");
