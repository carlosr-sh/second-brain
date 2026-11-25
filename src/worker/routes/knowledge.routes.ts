import { Hono, type Context } from "hono";
import { z } from "zod";
import type { ApiSuccess } from "../../shared/api";
import {
  bookmarkListQuerySchema, createBookmarkSchema, createBookSchema, createNoteSchema, createNotebookSchema, createResourceSchema, createTagSchema,
  noteListQuerySchema, searchQuerySchema, setTagsSchema, updateBookmarkSchema, updateBookSchema, updateNoteSchema, updateNotebookSchema,
  updateResourceSchema, updateTagSchema, type Taggable,
} from "../../shared/knowledge";
import { listArchivedQuerySchema } from "../../shared/para";
import { UUID_REGEX } from "../../shared/uuid";
import { AppError } from "../lib/errors";
import { parseIdParam, parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types";

const ok = <T>(c: Context<AppEnv>, data: T, status: 200 | 201 = 200) => c.json<ApiSuccess<T>>({ data }, status);
const idOf = (c: Context<AppEnv>) => parseIdParam(c.req.param("id"));
const archivedOf = (c: Context<AppEnv>) => listArchivedQuerySchema.parse(c.req.query()).archived === "true";
const noContent = (c: Context<AppEnv>) => c.body(null, 204);
const s = (c: Context<AppEnv>) => c.get("services");

export const noteRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { archived, ...q } = noteListQuerySchema.parse(c.req.query());
    return ok(c, await s(c).notes.list({ archived: archived === "true", ...q }));
  })
  .post("/", async (c) => ok(c, await s(c).notes.create(await parseJsonBody(c, createNoteSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).notes.get(idOf(c))))
  .get("/:id/backlinks", async (c) => ok(c, await s(c).notes.backlinks(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).notes.update(idOf(c), await parseJsonBody(c, updateNoteSchema))))
  .delete("/:id", async (c) => (await s(c).notes.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).notes.restore(idOf(c))));

/** Inbox → note (atomic). */
export const inboxToNoteRoutes = new Hono<AppEnv>().post("/:id/convert-to-note", async (c) => ok(c, await s(c).notes.convertFromInbox(idOf(c), s(c).inboxRepo), 201));

export const notebookRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).notebooks.list(archivedOf(c))))
  .post("/", async (c) => ok(c, await s(c).notebooks.create(await parseJsonBody(c, createNotebookSchema)), 201))
  .patch("/:id", async (c) => ok(c, await s(c).notebooks.update(idOf(c), await parseJsonBody(c, updateNotebookSchema))))
  .delete("/:id", async (c) => (await s(c).notebooks.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).notebooks.restore(idOf(c))));

export const resourceRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).resources.list(archivedOf(c))))
  .post("/", async (c) => ok(c, await s(c).resources.create(await parseJsonBody(c, createResourceSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).resources.get(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).resources.update(idOf(c), await parseJsonBody(c, updateResourceSchema))))
  .delete("/:id", async (c) => (await s(c).resources.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).resources.restore(idOf(c))));

export const tagRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).tags.list()))
  .post("/", async (c) => ok(c, await s(c).tags.create(await parseJsonBody(c, createTagSchema)), 201))
  .patch("/:id", async (c) => ok(c, await s(c).tags.update(idOf(c), await parseJsonBody(c, updateTagSchema))))
  .delete("/:id", async (c) => (await s(c).tags.delete(idOf(c)), noContent(c)));

/** PUT /api/{notes|tasks|projects|bookmarks|books}/:id/tags — replaces the tag set. */
const COLLECTION_TO_ENTITY: Record<string, Taggable> = { notes: "note", tasks: "task", projects: "project", bookmarks: "bookmark", books: "book" };
export const tagAssignRoutes = new Hono<AppEnv>().put("/:collection{(notes|tasks|projects|bookmarks|books)}/:id/tags", async (c) => {
  const entity = COLLECTION_TO_ENTITY[c.req.param("collection")] as Taggable;
  const { tagIds } = await parseJsonBody(c, setTagsSchema);
  return ok(c, { tagIds: await s(c).tags.setTags(entity, idOf(c), tagIds) });
});

export const bookmarkRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const q = bookmarkListQuerySchema.parse(c.req.query());
    return ok(c, await s(c).bookmarks.list({ archived: q.archived === "true", resourceId: q.resourceId, tagId: q.tagId, unread: q.unread === "true" }));
  })
  .post("/", async (c) => ok(c, await s(c).bookmarks.create(await parseJsonBody(c, createBookmarkSchema)), 201))
  .patch("/:id", async (c) => ok(c, await s(c).bookmarks.update(idOf(c), await parseJsonBody(c, updateBookmarkSchema))))
  .delete("/:id", async (c) => (await s(c).bookmarks.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).bookmarks.restore(idOf(c))));

const bookQuery = z.object({ resourceId: z.string().regex(UUID_REGEX).optional(), tagId: z.string().regex(UUID_REGEX).optional() });
export const bookRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).books.list({ archived: archivedOf(c), ...bookQuery.parse(c.req.query()) })))
  .post("/", async (c) => ok(c, await s(c).books.create(await parseJsonBody(c, createBookSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).books.get(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).books.update(idOf(c), await parseJsonBody(c, updateBookSchema))))
  .delete("/:id", async (c) => (await s(c).books.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).books.restore(idOf(c))));

export const searchRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const { q, types, limit } = searchQuerySchema.parse(c.req.query());
  return ok(c, await s(c).search.search(q, types, limit));
});

/** RFC 5987/6266 Content-Disposition with a safe ASCII fallback. */
function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const fileRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
    const body = await c.req.parseBody().catch(() => {
      throw new AppError(400, "BAD_REQUEST", "Envio multipart inválido");
    });
    const file = body.file;
    if (!(file instanceof File)) throw new AppError(400, "VALIDATION_FAILED", "Campo 'file' ausente");
    return ok(c, await s(c).files.upload(file), 201);
  })
  .get("/:id/meta", async (c) => ok(c, await s(c).files.get(idOf(c))))
  .get("/:id", async (c) => {
    const { row, body } = await s(c).files.open(idOf(c));
    const isImage = row.mimeType.startsWith("image/");
    return new Response(body, {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(row.sizeBytes),
        // Images render inline; PDFs download (a sandbox CSP breaks browser PDF viewers).
        "Content-Disposition": contentDisposition(isImage ? "inline" : "attachment", row.originalName),
        // Content is immutable per id; private = browser cache only, never shared caches.
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        ETag: `"${row.sha256}"`,
      },
    });
  });
