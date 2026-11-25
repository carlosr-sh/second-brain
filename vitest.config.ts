import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests execute INSIDE workerd (the production Workers runtime) with real
 * local D1 and R2 bindings simulated by Miniflare. Migrations are read here
 * (Node side) and applied by tests/setup.ts (runtime side).
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));
  return {
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
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/setup.ts"],
    },
  };
});
