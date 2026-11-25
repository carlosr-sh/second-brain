import type { AppConfig } from "./config";
import type { RequestMeta } from "./services/audit.service";
import type { Services } from "./services/container";

export interface Identity {
  email: string;
  source: "access" | "dev";
}

/** Hono generic: bindings + per-request variables set by middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    requestId: string;
    config: AppConfig;
    services: Services;
    identity: Identity;
  };
}

export type { RequestMeta };
