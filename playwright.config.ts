import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real dev stack (Vite + Worker in workerd +
 * local D1). Auth uses the local development bypass.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:5173", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile/ },
    // iPhone viewport/touch/UA on Chromium (WebKit is not installed here; real
    // Safari behaviour is covered by the manual checklist in docs/MOBILE.md).
    { name: "iphone", use: { ...devices["iPhone 14"], browserName: "chromium" }, testMatch: /mobile/ },
  ],
  webServer: {
    command: "pnpm exec vite --port 5173 --strictPort",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
