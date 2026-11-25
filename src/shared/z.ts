import { z } from "zod";

/**
 * The ONLY place that imports the `z` value from "zod". Everything else imports
 * `z` from here.
 *
 * Why: Zod 4 probes `new Function` (to enable JIT parsers) when object schemas
 * are CONSTRUCTED. Under our CSP (`script-src 'self'`, no 'unsafe-eval') that
 * probe is reported as a violation, and Workers forbid eval too. `jitless`
 * disables it — but it must run before ANY schema is built. Calling it from an
 * entrypoint is fragile: bundlers may hoist shared schema modules into a chunk
 * that executes first (this happened). Importing `z` from this module makes the
 * ordering a language guarantee: a module's dependencies always evaluate first.
 *
 * Enforced by tests/shared/zod-import.test.ts.
 */
z.config({ jitless: true });

export { z };
