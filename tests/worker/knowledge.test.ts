import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Book, Bookmark, Note, NoteRef, NoteSummary, Resource, SearchResult, StoredFile, Tag } from "../../src/shared/knowledge";
import { HL_END, HL_START } from "../../src/shared/knowledge";
import type { Project, Task, TrashItem } from "../../src/shared/para";
import { createFakeAccess } from "../helpers/access";
import { makeApi, makeClient } from "../helpers/app";

let api: ReturnType<typeof makeApi>;
let call: ReturnType<typeof makeClient>;
let token: string;

beforeAll(async () => {
  const fake = await createFakeAccess();
  call = makeClient(fake.keyResolver);
  token = await fake.sign();
  api = makeApi(call, token);
});

beforeEach(async () => {
  for (const t of ["note_links", "note_tags", "note_attachments", "book_notes", "notes", "bookmarks", "books", "resources", "notebooks", "tags", "tasks", "projects", "files", "audit_logs"]) {
    await env.DB.prepare(`delete from ${t}`).run();
  }
});

const doc = (...paragraphs: unknown[][]) => ({ type: "doc", content: paragraphs.map((c) => ({ type: "paragraph", content: c })) });
const text = (t: string) => ({ type: "text", text: t });
const link = (id: string, label: string) => ({ type: "noteLink", attrs: { id, label } });
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("notes", () => {
  it("creates notes, derives text server-side and tracks backlinks", async () => {
    const target = await api.ok<Note>("POST", "/api/notes", { title: "Método PARA", content: doc([text("Projetos, áreas, recursos.")]) });
    const source = await api.ok<Note>("POST", "/api/notes", {
      title: "Produtividade",
      content: doc([text("Baseado em "), link(target.id, "Método PARA"), text(" e "), link("0190a0a0-0000-7000-8000-000000000999", "inexistente")]),
    });
    expect(source.excerpt).toContain("Baseado em Método PARA");
    expect(await api.ok<NoteRef[]>("GET", `/api/notes/${target.id}/backlinks`)).toEqual([expect.objectContaining({ id: source.id, title: "Produtividade" })]);
    // dangling link to a non-existent note is ignored (no FK violation)
    expect(await env.DB.prepare("select count(*) n from note_links where source_note_id = ?").bind(source.id).first("n")).toBe(1);

    // removing the link from the content removes the backlink
    await api.ok("PATCH", `/api/notes/${source.id}`, { content: doc([text("sem links agora")]) });
    expect(await api.ok<NoteRef[]>("GET", `/api/notes/${target.id}/backlinks`)).toEqual([]);
    // trashed sources don't show as backlinks
    await api.ok("PATCH", `/api/notes/${source.id}`, { content: doc([link(target.id, "x")]) });
    await api.ok("DELETE", `/api/notes/${source.id}`);
    expect(await api.ok<NoteRef[]>("GET", `/api/notes/${target.id}/backlinks`)).toEqual([]);
  });

  it("rejects malicious documents and stores only the sanitized version", async () => {
    const bad = await api.req("POST", "/api/notes", { content: doc([{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]) });
    expect(bad.status).toBe(400);
    expect((await api.req("POST", "/api/notes", { content: { type: "doc", content: [{ type: "iframe" }] } })).status).toBe(400);
    const n = await api.ok<Note>("POST", "/api/notes", { content: { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "steal()" }, content: [text("ok")] }] } });
    const stored = await env.DB.prepare("select content_json from notes where id = ?").bind(n.id).first<{ content_json: string }>();
    expect(stored?.content_json).not.toContain("onclick");
  });

  it("enforces the single PARA location and filters lists", async () => {
    const project = await api.ok<Project>("POST", "/api/projects", { name: "P" });
    const resource = await api.ok<Resource>("POST", "/api/resources", { name: "TypeScript" });
    expect((await api.req("POST", "/api/notes", { title: "x", projectId: project.id, resourceId: resource.id })).status).toBe(400);
    const n = await api.ok<Note>("POST", "/api/notes", { title: "n", projectId: project.id });
    const moved = await api.ok<Note>("PATCH", `/api/notes/${n.id}`, { resourceId: resource.id });
    expect(moved).toMatchObject({ projectId: null, resourceId: resource.id });
    expect((await api.ok<NoteSummary[]>("GET", `/api/notes?resourceId=${resource.id}`)).map((x) => x.id)).toEqual([n.id]);
    expect((await api.ok<Resource[]>("GET", "/api/resources"))[0]?.counts.notes).toBe(1);
  });
});

describe("tags", () => {
  it("assigns tags to several entity types and filters by tag", async () => {
    const t1 = await api.ok<Tag>("POST", "/api/tags", { name: "ideia" });
    expect(await code(await api.req("POST", "/api/tags", { name: "IDEIA" }))).toBe("CONFLICT"); // case-insensitive unique
    const note = await api.ok<Note>("POST", "/api/notes", { title: "n", tagIds: [t1.id] });
    const task = await api.ok<Task>("POST", "/api/tasks", { title: "t" });
    await api.ok("PUT", `/api/tasks/${task.id}/tags`, { tagIds: [t1.id, t1.id] }); // duplicates collapsed
    expect((await api.ok<Tag[]>("GET", "/api/tags"))[0]?.usage).toBe(2);
    expect((await api.ok<NoteSummary[]>("GET", `/api/notes?tagId=${t1.id}`)).map((n) => n.id)).toEqual([note.id]);
    expect((await api.req("PUT", `/api/notes/${note.id}/tags`, { tagIds: ["0190a0a0-0000-7000-8000-000000000999"] })).status).toBe(404);
    await api.ok("DELETE", `/api/tags/${t1.id}`);
    expect((await api.ok<Note>("GET", `/api/notes/${note.id}`)).tagIds).toEqual([]);
  });
});

describe("full-text search", () => {
  it("finds across entities, ignores accents, highlights safely and drops trashed items", async () => {
    await api.ok("POST", "/api/notes", { title: "Reunião de planejamento", content: doc([text("Discutimos a migração do banco.")]) });
    const task = await api.ok<Task>("POST", "/api/tasks", { title: "Revisar migracao", notes: "checar índices" });
    await api.ok("POST", "/api/bookmarks", { url: "https://developers.cloudflare.com/d1/", title: "Docs D1", description: "migração e FTS" });

    const results = await api.ok<SearchResult[]>("GET", `/api/search?q=${encodeURIComponent("migração")}`);
    expect(results.map((r) => r.entity).sort()).toEqual(["bookmark", "note", "task"]);
    const t = results.find((r) => r.entity === "task");
    expect(t?.title).toBe(`Revisar ${HL_START}migracao${HL_END}`);

    expect((await api.ok<SearchResult[]>("GET", "/api/search?q=reun&types=note")).map((r) => r.entity)).toEqual(["note"]); // prefix
    await api.ok("DELETE", `/api/tasks/${task.id}`);
    expect((await api.ok<SearchResult[]>("GET", "/api/search?q=migracao")).some((r) => r.entity === "task")).toBe(false);
  });

  it.each(['"', "AND OR NOT", "a* NEAR(b c)", "title:x", "((", "-x", "^"])("treats FTS syntax as plain text: %j", async (q) => {
    const res = await api.req("GET", `/api/search?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
  });
});

describe("bookmarks and books", () => {
  it("bookmark read-later flow and URL validation", async () => {
    expect((await api.req("POST", "/api/bookmarks", { url: "javascript:alert(1)", title: "x" })).status).toBe(400);
    const b = await api.ok<Bookmark>("POST", "/api/bookmarks", { url: "https://example.com/a", title: "Artigo" });
    expect(await api.ok<Bookmark[]>("GET", "/api/bookmarks?unread=true")).toHaveLength(1);
    await api.ok("PATCH", `/api/bookmarks/${b.id}`, { read: true });
    expect(await api.ok<Bookmark[]>("GET", "/api/bookmarks?unread=true")).toHaveLength(0);
  });

  it("books with reading notes and rating bounds", async () => {
    const book = await api.ok<Book>("POST", "/api/books", { title: "Building a Second Brain", author: "Tiago Forte", status: "reading" });
    expect((await api.req("PATCH", `/api/books/${book.id}`, { rating: 6 })).status).toBe(400);
    const note = await api.ok<Note>("POST", "/api/notes", { title: "Notas do livro", bookId: book.id });
    expect((await api.ok<Book>("GET", `/api/books/${book.id}`)).noteCount).toBe(1);
    expect((await api.ok<NoteSummary[]>("GET", `/api/notes?bookId=${book.id}`)).map((n) => n.id)).toEqual([note.id]);
  });
});

describe("files (R2)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const upload = (bytes: Uint8Array, name: string, type: string, headers: Record<string, string> = {}) => {
    const form = new FormData();
    form.append("file", new File([bytes], name, { type }));
    return call("/api/files", { method: "POST", body: form, headers: { "cf-access-jwt-assertion": token, "sec-fetch-site": "same-origin", ...headers } });
  };

  it("stores by sniffed type, serves with safe headers and links as note attachment", async () => {
    const res = await upload(PNG, "../../etc/foto.svg", "image/svg+xml"); // declared type & name are ignored
    expect(res.status).toBe(201);
    const file = ((await res.json()) as { data: StoredFile }).data;
    expect(file).toMatchObject({ mimeType: "image/png", originalName: "foto.svg", sizeBytes: PNG.length });
    expect(await env.FILES.head(`files/${file.id}`)).not.toBeNull();

    const get = await call(file.url, { headers: { "cf-access-jwt-assertion": token } });
    expect(get.headers.get("content-type")).toBe("image/png");
    expect(get.headers.get("content-security-policy")).toContain("sandbox");
    expect(get.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(PNG);

    const note = await api.ok<Note>("POST", "/api/notes", { content: { type: "doc", content: [{ type: "image", attrs: { src: file.url, alt: "foto" } }] } });
    expect(await env.DB.prepare("select file_id from note_attachments where note_id = ?").bind(note.id).first("file_id")).toBe(file.id);
  });

  it("rejects disguised, empty and cross-site uploads", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await upload(svg, "x.png", "image/png")).status).toBe(415);
    expect((await upload(new Uint8Array(), "x.png", "image/png")).status).toBe(400);
    expect((await upload(PNG, "x.png", "image/png", { "sec-fetch-site": "cross-site" })).status).toBe(403);
  });
});

describe("trash for knowledge items", () => {
  it("lists, restores and purges notes; purge is audited", async () => {
    const n = await api.ok<Note>("POST", "/api/notes", { title: "Rascunho" });
    await api.ok("DELETE", `/api/notes/${n.id}`);
    expect((await api.ok<TrashItem[]>("GET", "/api/trash")).map((i) => `${i.entity}:${i.title}`)).toEqual(["note:Rascunho"]);
    await api.ok("POST", `/api/notes/${n.id}/restore`);
    await api.ok("DELETE", `/api/notes/${n.id}`);
    await api.ok("DELETE", `/api/trash/note/${n.id}`);
    expect(await env.DB.prepare("select count(*) n from notes").first("n")).toBe(0);
    expect(await env.DB.prepare("select count(*) n from search_index where entity_id = ?").bind(n.id).first("n")).toBe(0);
    expect(await env.DB.prepare("select action from audit_logs").first("action")).toBe("trash.purge");
  });
});
