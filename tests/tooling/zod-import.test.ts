import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

it('the `z` value is only imported from src/shared/z.ts (guarantees jitless before any schema is built)', () => {
  const offenders = files("src").filter((p) => p !== join("src", "shared", "z.ts") && /import\s*\{[^}]*\bz\b[^}]*\}\s*from\s*["']zod["']/.test(readFileSync(p, "utf8")));
  expect(offenders).toEqual([]);
});
