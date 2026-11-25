import { Hono } from "hono";
import { z } from "../../shared/z";
import type { ApiSuccess } from "../../shared/api";
import type { Settings } from "../../shared/settings";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types";

const putSchema = z.object({ value: z.unknown() });

export const settingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json<ApiSuccess<Settings>>({ data: await c.get("services").settings.getAll() }))
  .put("/:key", async (c) => {
    const { value } = await parseJsonBody(c, putSchema);
    const settings = await c.get("services").settings.set(c.req.param("key"), value);
    return c.json<ApiSuccess<Settings>>({ data: settings });
  });
