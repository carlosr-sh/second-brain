import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { BOOK_STATUS } from "../../../shared/enums";
import {
  archivable,
  atMostOneCheck,
  dateColumn,
  enumCheck,
  id,
  isoDateCheck,
  softDelete,
  timestamps,
} from "./_helpers";
import { files } from "./files";
import { areas, projects } from "./para";
import { tags } from "./tags";

/** PARA — Resources: topics/themes of ongoing interest (e.g. "TypeScript"). */
export const resources = sqliteTable(
  "resources",
  {
    id: id(),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [index("resources_area_idx").on(t.areaId)],
);

/** Notebooks: user-defined collections of notes (orthogonal to PARA). Nestable. */
export const notebooks = sqliteTable(
  "notebooks",
  {
    id: id(),
    parentId: text("parent_id").references((): AnySQLiteColumn => notebooks.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    position: real("position").notNull().default(0),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("notebooks_parent_idx").on(t.parentId),
    check("notebooks_not_own_parent_ck", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
  ],
);

/**
 * Knowledge notes. Content is stored twice on purpose, with distinct roles:
 *  - content_json: Tiptap/ProseMirror document (source of truth for editing)
 *  - content_text: derived plain text (FTS indexing, Markdown export, previews)
 * PARA location: at most one of project / area / resource.
 */
export const notes = sqliteTable(
  "notes",
  {
    id: id(),
    notebookId: text("notebook_id").references(() => notebooks.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    resourceId: text("resource_id").references(() => resources.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    contentJson: text("content_json", { mode: "json" }),
    contentText: text("content_text").notNull().default(""),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("notes_notebook_idx").on(t.notebookId),
    index("notes_project_idx").on(t.projectId),
    index("notes_area_idx").on(t.areaId),
    index("notes_resource_idx").on(t.resourceId),
    index("notes_updated_idx").on(t.updatedAt),
    atMostOneCheck("notes_single_location_ck", [t.projectId, t.areaId, t.resourceId]),
  ],
);

/** Directed note → note links ([[wikilinks]]). Backlinks = reverse lookup. */
export const noteLinks = sqliteTable(
  "note_links",
  {
    sourceNoteId: text("source_note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
    targetNoteId: text("target_note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.sourceNoteId, t.targetNoteId] }),
    index("note_links_target_idx").on(t.targetNoteId),
    check("note_links_no_self_ck", sql`${t.sourceNoteId} <> ${t.targetNoteId}`),
  ],
);

export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] }), index("note_tags_tag_idx").on(t.tagId)],
);

export const noteAttachments = sqliteTable(
  "note_attachments",
  {
    noteId: text("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
    fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.fileId] }), index("note_attachments_file_idx").on(t.fileId)],
);

/** Bookmarks: saved web links, optionally filed under a Resource. */
export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: id(),
    resourceId: text("resource_id").references(() => resources.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    /** "Read later" workflow: null = unread. */
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [index("bookmarks_resource_idx").on(t.resourceId), index("bookmarks_url_idx").on(t.url)],
);

export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookmarkId, t.tagId] }), index("bookmark_tags_tag_idx").on(t.tagId)],
);

/** Bookshelf. Reading notes live in `notes` linked via `book_notes`. */
export const books = sqliteTable(
  "books",
  {
    id: id(),
    resourceId: text("resource_id").references(() => resources.id, { onDelete: "set null" }),
    coverFileId: text("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    author: text("author"),
    isbn: text("isbn"),
    pageCount: integer("page_count"),
    status: text("status", { enum: BOOK_STATUS }).notNull().default("want_to_read"),
    rating: integer("rating"),
    startedOn: dateColumn("started_on"),
    finishedOn: dateColumn("finished_on"),
    summary: text("summary"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("books_status_idx").on(t.status),
    enumCheck("books_status_ck", t.status, BOOK_STATUS),
    check("books_rating_ck", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
    check("books_page_count_ck", sql`${t.pageCount} is null or ${t.pageCount} > 0`),
    isoDateCheck("books_started_on_ck", t.startedOn),
    isoDateCheck("books_finished_on_ck", t.finishedOn),
  ],
);

export const bookNotes = sqliteTable(
  "book_notes",
  {
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    noteId: text("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.noteId] }), index("book_notes_note_idx").on(t.noteId)],
);

export const bookTags = sqliteTable(
  "book_tags",
  {
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.tagId] }), index("book_tags_tag_idx").on(t.tagId)],
);
