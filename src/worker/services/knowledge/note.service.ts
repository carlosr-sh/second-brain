import { uuidv7 } from "../../../shared/uuid";
import type { CreateNoteInput, Note, NoteRef, NoteSummary, UpdateNoteInput } from "../../../shared/knowledge";
import { emptyDoc, extractFileIds, extractNoteLinkIds, extractText, type RichDoc } from "../../../shared/rich-text";
import { assertLive, badRequest, conflict, notFound } from "../../lib/errors";
import type { AreaRepository } from "../../repositories/area.repository";
import type { NotebookRepository, ResourceRepository } from "../../repositories/knowledge/notebook.repository";
import type { BookRepository } from "../../repositories/knowledge/library.repository";
import type { NewNote, NoteRepository, NoteRow } from "../../repositories/knowledge/note.repository";
import type { TagRepository } from "../../repositories/knowledge/tag.repository";
import type { ProjectRepository } from "../../repositories/project.repository";
import { iso, isoRequired } from "../../repositories/_shared";

interface Location {
  projectId?: string | null;
  areaId?: string | null;
  resourceId?: string | null;
  notebookId?: string | null;
}

export class NoteService {
  constructor(
    private readonly repo: NoteRepository,
    private readonly tags: TagRepository,
    private readonly refs: { projects: ProjectRepository; areas: AreaRepository; resources: ResourceRepository; notebooks: NotebookRepository; books: BookRepository },
  ) {}

  async list(filter: { archived: boolean; notebookId?: string; projectId?: string; areaId?: string; resourceId?: string; tagId?: string; bookId?: string }): Promise<NoteSummary[]> {
    const { tagId, bookId, ...rest } = filter;
    const ids = tagId ? this.tags.entityIdsWithTag("note", tagId).getSQL() : bookId ? this.repo.bookNoteIds(bookId).getSQL() : undefined;
    const rows = await this.repo.list({ ...rest, ids });
    const tagMap = await this.tags.tagIdsFor("note", rows.map((r) => r.id));
    return rows.map((r) => summaryDto(r, tagMap.get(r.id) ?? []));
  }

  async get(id: string): Promise<Note> {
    const row = assertLive(await this.repo.findById(id), "Nota");
    const tagIds = (await this.tags.tagIdsFor("note", [id])).get(id) ?? [];
    const content = (row.contentJson as RichDoc | null) ?? emptyDoc();
    return {
      ...summaryDto({ ...row, excerpt: row.contentText.slice(0, 240) }, tagIds),
      content,
      wordCount: row.contentText.split(/\s+/).filter(Boolean).length,
    };
  }

  async backlinks(id: string): Promise<NoteRef[]> {
    assertLive(await this.repo.findById(id), "Nota");
    return this.repo.backlinks(id);
  }

  /** PARA rule: at most one of project / area / resource; setting one clears the others. */
  private async resolveLocation(input: Location, current?: NoteRow): Promise<Location> {
    const out: Location = {};
    const sides = ["projectId", "areaId", "resourceId"] as const;
    const given = sides.filter((k) => input[k] !== undefined);
    const nonNullGiven = given.filter((k) => input[k]);
    if (nonNullGiven.length > 1) throw badRequest("Uma nota fica em um projeto OU área OU recurso");
    if (given.length) {
      for (const k of sides) out[k] = nonNullGiven[0] === k ? (input[k] as string) : input[k] === undefined && current && !nonNullGiven.length ? current[k] : null;
    }
    if (out.projectId) assertLive(await this.refs.projects.findById(out.projectId), "Projeto");
    if (out.areaId) assertLive(await this.refs.areas.findById(out.areaId), "Área");
    if (out.resourceId) assertLive(await this.refs.resources.findById(out.resourceId), "Recurso");
    if (input.notebookId !== undefined) {
      if (input.notebookId) assertLive(await this.refs.notebooks.findById(input.notebookId), "Caderno");
      out.notebookId = input.notebookId;
    }
    return out;
  }

  /** Derived data from content: plain text, outgoing links (live, not self) and attachments. */
  private async derive(id: string, doc: RichDoc) {
    const linkTargets = (await this.repo.liveIds(extractNoteLinkIds(doc))).filter((t) => t !== id);
    const fileIds = await this.repo.liveFileIds(extractFileIds(doc));
    return { text: extractText(doc), linkTargets, fileIds };
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const id = uuidv7();
    const { content, tagIds, bookId, title, ...loc } = input;
    const location = await this.resolveLocation(loc);
    if (bookId) assertLive(await this.refs.books.findById(bookId), "Livro");
    const doc = content ?? emptyDoc();
    const d = await this.derive(id, doc);
    const values: NewNote = { id, title: title ?? "", contentJson: doc, contentText: d.text, ...location };
    await this.repo.save({ insert: values }, { linkTargets: d.linkTargets, fileIds: d.fileIds }, { bookId });
    if (tagIds?.length) await this.setTags(id, tagIds);
    return this.get(id);
  }

  async update(id: string, input: UpdateNoteInput): Promise<Note> {
    const current = assertLive(await this.repo.findById(id), "Nota");
    const { content, archived, projectId, areaId, resourceId, notebookId, ...fields } = input;
    const values: Partial<NewNote> = { ...fields, ...(await this.resolveLocation({ projectId, areaId, resourceId, notebookId }, current)) };
    if (archived !== undefined) values.archivedAt = archived ? (current.archivedAt ?? new Date()) : null;
    let derived: { linkTargets: string[]; fileIds: string[] } | undefined;
    if (content) {
      const d = await this.derive(id, content);
      values.contentJson = content;
      values.contentText = d.text;
      derived = { linkTargets: d.linkTargets, fileIds: d.fileIds };
    }
    await this.repo.save({ update: { id, values } }, derived);
    return this.get(id);
  }

  async setTags(id: string, tagIds: string[]): Promise<string[]> {
    assertLive(await this.repo.findById(id), "Nota");
    const existing = await this.tags.existingIds(tagIds);
    if (existing.length !== tagIds.length) throw notFound("Tag não encontrada");
    await this.tags.setTags("note", id, tagIds);
    return tagIds;
  }

  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Nota");
    await this.repo.update(id, { deletedAt: new Date() });
  }

  async restore(id: string): Promise<Note> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Nota não encontrada");
    if (!row.deletedAt) throw conflict("A nota não está na lixeira");
    await this.repo.update(id, { deletedAt: null });
    return this.get(id);
  }
}

function summaryDto(r: Pick<NoteRow, "id" | "title" | "notebookId" | "projectId" | "areaId" | "resourceId" | "isPinned" | "isFavorite" | "archivedAt" | "createdAt" | "updatedAt"> & { excerpt: string }, tagIds: string[]): NoteSummary {
  return {
    id: r.id, title: r.title, excerpt: r.excerpt, notebookId: r.notebookId, projectId: r.projectId, areaId: r.areaId,
    resourceId: r.resourceId, isPinned: r.isPinned, isFavorite: r.isFavorite, tagIds, archivedAt: iso(r.archivedAt),
    createdAt: isoRequired(r.createdAt), updatedAt: isoRequired(r.updatedAt),
  };
}
