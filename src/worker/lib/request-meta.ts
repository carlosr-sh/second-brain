import type { Context } from "hono";
import type { AppEnv, RequestMeta } from "../types";

export function requestMeta(c: Context<AppEnv>): RequestMeta {
  return {
    actorEmail: c.get("identity")?.email ?? null,
    requestId: c.get("requestId"),
    ipAddress: c.req.header("cf-connecting-ip") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  };
}

export const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/");
