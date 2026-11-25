import { Hono } from "hono";
import type { ApiSuccess } from "../../shared/api";
import { createInboxItemSchema, inboxListQuerySchema, updateInboxItemSchema, type InboxItem } from "../../shared/inbox";
import { parseIdParam, parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types";

export const inboxRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { status } = inboxListQuerySchema.parse(c.req.query());
    return c.json<ApiSuccess<InboxItem[]>>({ data: await c.get("services").inbox.list(status) });
  })
  .get("/count", async (c) => c.json<ApiSuccess<{ open: number }>>({ data: { open: await c.get("services").inbox.countOpen() } }))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, createInboxItemSchema);
    return c.json<ApiSuccess<InboxItem>>({ data: await c.get("services").inbox.capture(input) }, 201);
  })
  .patch("/:id", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    const input = await parseJsonBody(c, updateInboxItemSchema);
    return c.json<ApiSuccess<InboxItem>>({ data: await c.get("services").inbox.update(id, input) });
  })
  .delete("/:id", async (c) => {
    await c.get("services").inbox.trash(parseIdParam(c.req.param("id")));
    return c.body(null, 204);
  });
