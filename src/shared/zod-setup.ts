import { z } from "zod";

/**
 * Zod 4 probes `new Function` to enable JIT-compiled parsers. Under our strict
 * CSP (`script-src 'self'`, no 'unsafe-eval') that probe is reported as a
 * security-policy violation even though Zod catches the error, and Workers
 * forbid eval as well. `jitless` disables the probe; validation stays correct.
 *
 * Must be imported before any schema is used (first import of each entrypoint).
 */
z.config({ jitless: true });
