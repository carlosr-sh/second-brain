import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is used ONLY to generate SQL migrations from the TypeScript
 * schema. Migrations are applied by Wrangler (`wrangler d1 migrations apply`),
 * which tracks them in the `d1_migrations` table.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/schema/index.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
