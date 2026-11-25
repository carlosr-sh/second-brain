import type { MiddlewareHandler } from "hono";
import { uuidv7 } from "../../shared/uuid";
import { loadConfig } from "../config";
import { createServices } from "../services/container";
import type { AppEnv } from "../types";

/** Assigns a request id (Cloudflare Ray ID when present). */
export const requestId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? uuidv7());
  await next();
};

/** Validates configuration (fail closed) and builds the service container. */
export const appContext = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const config = loadConfig(c.env); // throws ConfigError -> 500 via onError
  c.set("config", config);
  c.set("services", createServices(c.env, config.ENVIRONMENT, config.APP_TIMEZONE));
  await next();
};
