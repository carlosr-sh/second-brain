import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Two test projects:
 *  - worker: runs INSIDE workerd (production runtime) with local D1/R2.
 *  - client: React/browser logic in happy-dom (fast simulated DOM).
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(r("./migrations"));
  return {
    test: {
      projects: [
        {
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  ENVIRONMENT: "test",
                  OWNER_EMAIL: "owner@example.com",
                  ACCESS_TEAM_DOMAIN: "testteam.cloudflareaccess.com",
                  ACCESS_AUD: "test-audience-tag-0123456789abcdef",
                  DEV_AUTH_EMAIL: "",
                  TEST_MIGRATIONS: migrations,
                },
              },
            }),
          ],
          test: { name: "worker", include: ["tests/worker/**/*.test.ts"], setupFiles: ["./tests/worker/setup.ts"] },
        },
        {
          resolve: { alias: { "@": r("./src/client"), "@shared": r("./src/shared") } },
          test: {
            name: "client",
            environment: "happy-dom",
            include: ["tests/client/**/*.test.{ts,tsx}"],
            setupFiles: ["./tests/client/setup.ts"],
          },
        },
      ],
    },
  };
});
