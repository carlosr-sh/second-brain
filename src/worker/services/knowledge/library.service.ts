import type {
  Book, Bookmark, CreateBookInput, CreateBookmarkInput, Notebook, Resource, SearchEntity, SearchResult, Tag, Taggable, UpdateBookInput, UpdateBookmarkInput,
} from "../../../shared/knowledge";
import { assertLive, conflict, notFound } from "../../lib/errors";
import type { AreaRepository } from "../../repositories/area.repository";
import type { BookmarkRepository, BookmarkRow, BookRepository, BookRow, FileRepository } from "../../repositories/knowledge/library.repository";
import type { NotebookRepository, ResourceRepository } from "../../repositories/knowledge/notebook.repository";
import type { SearchRepository } from "../../repositories/knowledge/search.repository";
import type { TagRepository } from "../../repositories/knowledge/tag.repository";
import { iso, isoRequired } from "../../repositories/_shared";

type Archivable = { archivedAt: Date | null };
const archiveValue = (current: Archivable, archived: boolean | undefined) =>
  archived === undefined ? {} : { archivedAt: archived ? (current.archivedAt ?? new Date()) : null };

/** Generic trash/restore for entities with deletedAt. */
async function restoreRow(repo: { findById(id: string): Promise<{ deletedAt: Date | null } | undefined>; update(id: string, v: { deletedAt: null }): Promise<void> }, id: string, label: string) {
  const row = await repo.findById(id);
  if (!row) throw notFound(`${label} não encontrado(a)`);
  if (!row.deletedAt) throw conflict(`${label} não está na lixeira`);
  await repo.update(id, { deletedAt: null });
}

/* ---------------- tags ---------------- */
export class TagService {
  constructor(private readonly repo: TagRepository, private readonly taggables: Record<Taggable, { findById(id: string): Promise<{ deletedAt: Date | null } | undefined> }>) {}

  async list(): Promise<Tag[]> {
    return (await this.repo.list()).map((t) => ({ id: t.id, name: t.name, color: t.color, usage: t.usage }));
  }

  async create(input: { name: string; color?: string | null }): Promise<Tag> {
    const row = await this.repo.insert(input); // UNIQUE(name COLLATE NOCASE) → 409 via error handler
    return { id: row.id, name: row.name, color: row.color, usage: 0 };
  }

  async update(id: string, input: { name?: string; color?: string | null }): Promise<Tag> {
    if (!(await this.repo.findById(id))) throw notFound("Tag não encontrada");
    await this.repo.update(id, input);
    const tag = (await this.list()).find((t) => t.id === id);
    if (!tag) throw notFound("Tag não encontrada");
    return tag;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw notFound("Tag não encontrada");
    await this.repo.delete(id);
  }

  /** Replaces the tags of any taggable entity. */
  async setTags(entity: Taggable, id: string, tagIds: string[]): Promise<string[]> {
    assertLive(await this.taggables[entity].findById(id), "Item");
    if ((await this.repo.existingIds(tagIds)).length !== tagIds.length) throw notFound("Tag não encontrada");
    await this.repo.setTags(entity, id, tagIds);
    return tagIds;
  }
}

/* ---------------- notebooks ---------------- */
export class NotebookService {
  constructor(private readonly repo: NotebookRepository) {}

  async list(archived: boolean): Promise<Notebook[]> {
    return (await this.repo.list(archived)).map((n) => ({ id: n.id, name: n.name, description: n.description, icon: n.icon, noteCount: n.noteCount, archivedAt: iso(n.archivedAt) }));
  }
  private async one(id: string) {
    const n = (await this.list(false)).concat(await this.list(true)).find((x) => x.id === id);
    if (!n) throw notFound("Caderno não encontrado");
    return n;
  }
  async create(input: { name: string; description?: string | null; icon?: string | null }) {
    return this.one((await this.repo.insert(input)).id);
  }
  async update(id: string, input: { name?: string; description?: string | null; icon?: string | null; archived?: boolean }) {
    const current = assertLive(await this.repo.findById(id), "Caderno");
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.one(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Caderno");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Caderno");
    return this.one(id);
  }
}

/* ---------------- resources ---------------- */
export class ResourceService {
  constructor(private readonly repo: ResourceRepository, private readonly areas: AreaRepository) {}

  async list(archived: boolean): Promise<Resource[]> {
    return (await this.repo.list(archived)).map((r) => ({
      id: r.id, name: r.name, description: r.description, areaId: r.areaId, archivedAt: iso(r.archivedAt),
      counts: { notes: r.notes, bookmarks: r.bookmarks, books: r.books },
    }));
  }
  private async one(id: string) {
    const r = (await this.list(false)).concat(await this.list(true)).find((x) => x.id === id);
    if (!r) throw notFound("Recurso não encontrado");
    return r;
  }
  async get(id: string) {
    assertLive(await this.repo.findById(id), "Recurso");
    return this.one(id);
  }
  async create(input: { name: string; description?: string | null; areaId?: string | null }) {
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    return this.one((await this.repo.insert(input)).id);
  }
  async update(id: string, input: { name?: string; description?: string | null; areaId?: string | null; archived?: boolean }) {
    const current = assertLive(await this.repo.findById(id), "Recurso");
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.one(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Recurso");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Recurso");
    return this.one(id);
  }
}

/* ---------------- bookmarks ---------------- */
export class BookmarkService {
  constructor(private readonly repo: BookmarkRepository, private readonly tags: TagRepository, private readonly resources: ResourceRepository) {}

  async list(f: { archived: boolean; resourceId?: string; tagId?: string; unread?: boolean }): Promise<Bookmark[]> {
    const ids = f.tagId ? this.tags.entityIdsWithTag("bookmark", f.tagId).getSQL() : undefined;
    const rows = await this.repo.list({ archived: f.archived, resourceId: f.resourceId, unread: f.unread, ids });
    const tagMap = await this.tags.tagIdsFor("bookmark", rows.map((r) => r.id));
    return rows.map((r) => bookmarkDto(r, tagMap.get(r.id) ?? []));
  }
  async get(id: string): Promise<Bookmark> {
    const row = assertLive(await this.repo.findById(id), "Link");
    return bookmarkDto(row, (await this.tags.tagIdsFor("bookmark", [id])).get(id) ?? []);
  }
  async create(input: CreateBookmarkInput): Promise<Bookmark> {
    const { tagIds, ...values } = input;
    if (values.resourceId) assertLive(await this.resources.findById(values.resourceId), "Recurso");
    if (tagIds?.length && (await this.tags.existingIds(tagIds)).length !== tagIds.length) throw notFound("Tag não encontrada");
    const row = await this.repo.insert(values);
    if (tagIds?.length) await this.tags.setTags("bookmark", row.id, tagIds);
    return this.get(row.id);
  }
  async update(id: string, input: UpdateBookmarkInput): Promise<Bookmark> {
    const current = assertLive(await this.repo.findById(id), "Link");
    if (input.resourceId) assertLive(await this.resources.findById(input.resourceId), "Recurso");
    const { read, archived, ...values } = input;
    await this.repo.update(id, {
      ...values,
      ...archiveValue(current, archived),
      ...(read !== undefined ? { readAt: read ? (current.readAt ?? new Date()) : null } : {}),
    });
    return this.get(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Link");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Link");
    return this.get(id);
  }
}

function bookmarkDto(r: BookmarkRow, tagIds: string[]): Bookmark {
  return {
    id: r.id, url: r.url, title: r.title, description: r.description, resourceId: r.resourceId, isFavorite: r.isFavorite,
    readAt: iso(r.readAt), tagIds, archivedAt: iso(r.archivedAt), createdAt: isoRequired(r.createdAt),
  };
}

/* ---------------- books ---------------- */
export class BookService {
  constructor(private readonly repo: BookRepository, private readonly tags: TagRepository, private readonly resources: ResourceRepository, private readonly files: FileRepository) {}

  private async checkRefs(input: { resourceId?: string | null; coverFileId?: string | null }) {
    if (input.resourceId) assertLive(await this.resources.findById(input.resourceId), "Recurso");
    if (input.coverFileId) {
      const f = assertLive(await this.files.findById(input.coverFileId), "Arquivo");
      if (!f.mimeType.startsWith("image/")) throw conflict("A capa deve ser uma imagem");
    }
  }
  async list(f: { archived: boolean; resourceId?: string; tagId?: string }): Promise<Book[]> {
    const ids = f.tagId ? this.tags.entityIdsWithTag("book", f.tagId).getSQL() : undefined;
    const rows = await this.repo.list({ archived: f.archived, resourceId: f.resourceId, ids });
    const tagMap = await this.tags.tagIdsFor("book", rows.map((r) => r.book.id));
    return rows.map((r) => bookDto(r.book, r.noteCount, tagMap.get(r.book.id) ?? []));
  }
  async get(id: string): Promise<Book> {
    const row = await this.repo.findWithCount(id);
    if (!row || row.book.deletedAt) throw notFound("Livro não encontrado");
    return bookDto(row.book, row.noteCount, (await this.tags.tagIdsFor("book", [id])).get(id) ?? []);
  }
  async create(input: CreateBookInput): Promise<Book> {
    const { tagIds, ...values } = input;
    await this.checkRefs(values);
    if (tagIds?.length && (await this.tags.existingIds(tagIds)).length !== tagIds.length) throw notFound("Tag não encontrada");
    const row = await this.repo.insert(values);
    if (tagIds?.length) await this.tags.setTags("book", row.id, tagIds);
    return this.get(row.id);
  }
  async update(id: string, input: UpdateBookInput): Promise<Book> {
    const current = assertLive(await this.repo.findById(id), "Livro");
    await this.checkRefs(input);
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.get(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Livro");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Livro");
    return this.get(id);
  }
}

function bookDto(r: BookRow, noteCount: number, tagIds: string[]): Book {
  return {
    id: r.id, title: r.title, author: r.author, isbn: r.isbn, pageCount: r.pageCount, status: r.status, rating: r.rating,
    startedOn: r.startedOn, finishedOn: r.finishedOn, summary: r.summary, resourceId: r.resourceId, coverFileId: r.coverFileId,
    tagIds, noteCount, archivedAt: iso(r.archivedAt), createdAt: isoRequired(r.createdAt),
  };
}

/* ---------------- search ---------------- */
export class SearchService {
  constructor(private readonly repo: SearchRepository) {}
  search(q: string, types: SearchEntity[] | undefined, limit: number): Promise<SearchResult[]> {
    return this.repo.search(q, types, limit);
  }
}
