import { z } from "./z";
import { isoDateSchema } from "./dates";
import { BOOK_STATUS } from "./enums";
import { httpUrlSchema } from "./inbox";
import { richDocSchema, type RichDoc } from "./rich-text";
import { UUID_REGEX } from "./uuid";

const id = z.string().regex(UUID_REGEX, "ID inválido").transform((v) => v.toLowerCase());
const nullableId = id.nullable();
const name = z.string().trim().min(1, "Obrigatório").max(200);
const longText = z.string().max(20_000);
const nonEmpty = <T extends z.ZodObject>(s: T) => s.refine((v) => Object.keys(v).length > 0, "Nenhum campo para atualizar");
const tagIds = z.array(id).max(50).transform((ids) => [...new Set(ids)]);

/* ---------- tags ---------- */
export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[^,#]+$/, "Sem vírgulas ou #"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});
export const updateTagSchema = nonEmpty(createTagSchema.partial());
export const setTagsSchema = z.object({ tagIds });
export const TAGGABLE = ["note", "task", "project", "bookmark", "book"] as const;
export type Taggable = (typeof TAGGABLE)[number];

/* ---------- notebooks & resources ---------- */
export const createNotebookSchema = z.object({ name, description: longText.nullable().optional(), icon: z.string().max(40).nullable().optional() });
export const updateNotebookSchema = nonEmpty(createNotebookSchema.partial().extend({ archived: z.boolean().optional() }));
export const createResourceSchema = z.object({ name, description: longText.nullable().optional(), areaId: nullableId.optional() });
export const updateResourceSchema = nonEmpty(createResourceSchema.partial().extend({ archived: z.boolean().optional() }));

/* ---------- notes ---------- */
const noteLocation = {
  notebookId: nullableId.optional(),
  projectId: nullableId.optional(),
  areaId: nullableId.optional(),
  resourceId: nullableId.optional(),
};
export const createNoteSchema = z.object({
  title: z.string().trim().max(300).optional(),
  content: richDocSchema.optional(),
  tagIds: tagIds.optional(),
  bookId: id.optional(),
  ...noteLocation,
});
export const updateNoteSchema = nonEmpty(
  z.object({
    title: z.string().trim().max(300).optional(),
    content: richDocSchema.optional(),
    isPinned: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    archived: z.boolean().optional(),
    ...noteLocation,
  }),
);
export const noteListQuerySchema = z.object({
  notebookId: id.optional(),
  projectId: id.optional(),
  areaId: id.optional(),
  resourceId: id.optional(),
  tagId: id.optional(),
  bookId: id.optional(),
  archived: z.enum(["true", "false"]).default("false"),
});

/* ---------- bookmarks ---------- */
export const createBookmarkSchema = z.object({
  url: httpUrlSchema,
  title: name,
  description: longText.nullable().optional(),
  resourceId: nullableId.optional(),
  isFavorite: z.boolean().optional(),
  tagIds: tagIds.optional(),
});
export const updateBookmarkSchema = nonEmpty(
  createBookmarkSchema.omit({ tagIds: true }).partial().extend({ read: z.boolean().optional(), archived: z.boolean().optional() }),
);
export const bookmarkListQuerySchema = z.object({
  resourceId: id.optional(),
  tagId: id.optional(),
  unread: z.enum(["true"]).optional(),
  archived: z.enum(["true", "false"]).default("false"),
});

/* ---------- books ---------- */
export const createBookSchema = z.object({
  title: name,
  author: z.string().trim().max(200).nullable().optional(),
  isbn: z.string().trim().regex(/^[0-9Xx-]{10,17}$/, "ISBN inválido").nullable().optional(),
  pageCount: z.number().int().positive().max(100_000).nullable().optional(),
  status: z.enum(BOOK_STATUS).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  startedOn: isoDateSchema.nullable().optional(),
  finishedOn: isoDateSchema.nullable().optional(),
  summary: longText.nullable().optional(),
  resourceId: nullableId.optional(),
  coverFileId: nullableId.optional(),
  tagIds: tagIds.optional(),
});
export const updateBookSchema = nonEmpty(createBookSchema.omit({ tagIds: true }).partial().extend({ archived: z.boolean().optional() }));

/* ---------- search ---------- */
export const SEARCH_ENTITIES = ["note", "task", "project", "area", "goal", "resource", "bookmark", "book", "journal", "contact", "transaction"] as const;
export type SearchEntity = (typeof SEARCH_ENTITIES)[number];
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.string().transform((s) => s.split(",").filter(Boolean)).pipe(z.array(z.enum(SEARCH_ENTITIES))).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
/** Highlight markers inside snippets (control chars: can't appear in user text, no HTML involved). */
export const HL_START = "\u0002";
export const HL_END = "\u0003";

/* ---------- files ---------- */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"] as const;

/* ---------- DTOs ---------- */
export interface Tag { id: string; name: string; color: string | null; usage: number }
export interface Notebook { id: string; name: string; description: string | null; icon: string | null; noteCount: number; archivedAt: string | null }
export interface Resource { id: string; name: string; description: string | null; areaId: string | null; counts: { notes: number; bookmarks: number; books: number }; archivedAt: string | null }

export interface NoteSummary {
  id: string;
  title: string;
  excerpt: string;
  notebookId: string | null;
  projectId: string | null;
  areaId: string | null;
  resourceId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  tagIds: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Note extends NoteSummary {
  content: RichDoc;
  wordCount: number;
}
export interface NoteRef { id: string; title: string; excerpt: string }

export interface Bookmark {
  id: string; url: string; title: string; description: string | null; resourceId: string | null; isFavorite: boolean;
  readAt: string | null; tagIds: string[]; archivedAt: string | null; createdAt: string;
}
export interface Book {
  id: string; title: string; author: string | null; isbn: string | null; pageCount: number | null; status: (typeof BOOK_STATUS)[number];
  rating: number | null; startedOn: string | null; finishedOn: string | null; summary: string | null; resourceId: string | null;
  coverFileId: string | null; tagIds: string[]; noteCount: number; archivedAt: string | null; createdAt: string;
}
export interface StoredFile { id: string; url: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string }
export interface SearchResult { entity: SearchEntity; id: string; title: string; snippet: string; score: number }

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
