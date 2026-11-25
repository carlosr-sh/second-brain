import { z } from "../shared/z";
import { APP_TIMEZONE } from "../shared/constants";

/**
 * Runtime configuration, validated once per isolate. If anything required is
 * missing or malformed the app FAILS CLOSED (every request gets a 500) rather
 * than running with a half-configured auth layer.
 */
const configSchema = z.object({
  ENVIRONMENT: z.enum(["production", "development", "test"]),
  APP_TIMEZONE: z.string().min(1).default(APP_TIMEZONE),
  OWNER_EMAIL: z.email().transform((v) => v.toLowerCase()),
  ACCESS_TEAM_DOMAIN: z
    .string()
    .regex(/^[a-z0-9-]+\.cloudflareaccess\.com$/, "must look like <team>.cloudflareaccess.com"),
  ACCESS_AUD: z.string().min(16, "Access AUD tag looks too short"),
  DEV_AUTH_EMAIL: z
    .email()
    .transform((v) => v.toLowerCase())
    .optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration: ${issues.join("; ")}`);
    this.name = "ConfigError";
  }
}

const cache = new WeakMap<object, AppConfig>();

export function loadConfig(env: Env): AppConfig {
  const cached = cache.get(env);
  if (cached) return cached;

  const raw = env as unknown as Record<string, unknown>;
  const parsed = configSchema.safeParse({
    ENVIRONMENT: raw.ENVIRONMENT,
    APP_TIMEZONE: raw.APP_TIMEZONE,
    OWNER_EMAIL: raw.OWNER_EMAIL,
    ACCESS_TEAM_DOMAIN: raw.ACCESS_TEAM_DOMAIN,
    ACCESS_AUD: raw.ACCESS_AUD,
    DEV_AUTH_EMAIL: raw.DEV_AUTH_EMAIL || undefined,
  });
  if (!parsed.success) {
    // Only field names + messages are reported, never the values (secrets).
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  cache.set(env, parsed.data);
  return parsed.data;
}
