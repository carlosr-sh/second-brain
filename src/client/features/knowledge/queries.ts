import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Book, Bookmark, CreateBookInput, CreateBookmarkInput, CreateNoteInput, Note, Notebook, NoteRef, NoteSummary, Resource, SearchEntity,
  SearchResult, StoredFile, Tag, Taggable, UpdateBookInput, UpdateBookmarkInput, UpdateNoteInput,
} from "@shared/knowledge";
import { ENTITY_PATH } from "@shared/para";
import { api, ApiError, NetworkError } from "@/lib/api";
import { isOnline, markOffline } from "@/lib/connectivity";

export const kbKeys = {
  all: ["kb"] as const,
  notes: (p: Record<string, string> = {}) => ["kb", "notes", p] as const,
  note: (id: string) => ["kb", "note", id] as const,
  backlinks: (id: string) => ["kb", "backlinks", id] as const,
  tags: ["kb", "tags"] as const,
  notebooks: (archived = false) => ["kb", "notebooks", { archived }] as const,
  resources: (archived = false) => ["kb", "resources", { archived }] as const,
  resource: (id: string) => ["kb", "resource", id] as const,
  bookmarks: (p: Record<string, string> = {}) => ["kb", "bookmarks", p] as const,
  books: (p: Record<string, string> = {}) => ["kb", "books", p] as const,
  book: (id: string) => ["kb", "book", id] as const,
  search: (q: string, types: string) => ["kb", "search", q, types] as const,
};

const qs = (p: Record<string, string>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== "")).toString();
  return s ? `?${s}` : "";
};

/* ---------- queries ---------- */
export const useNotes = (p: Record<string, string> = {}) => useQuery({ queryKey: kbKeys.notes(p), queryFn: () => api<NoteSummary[]>(`/notes${qs(p)}`) });
export const useNote = (id: string | undefined) =>
  useQuery({ queryKey: kbKeys.note(id ?? ""), queryFn: () => api<Note>(`/notes/${id}`), enabled: !!id, staleTime: Infinity });
export const useBacklinks = (id: string) => useQuery({ queryKey: kbKeys.backlinks(id), queryFn: () => api<NoteRef[]>(`/notes/${id}/backlinks`) });
export const useTags = () => useQuery({ queryKey: kbKeys.tags, queryFn: () => api<Tag[]>("/tags") });
export const useNotebooks = (archived = false) => useQuery({ queryKey: kbKeys.notebooks(archived), queryFn: () => api<Notebook[]>(`/notebooks?archived=${archived}`) });
export const useResources = (archived = false) => useQuery({ queryKey: kbKeys.resources(archived), queryFn: () => api<Resource[]>(`/resources?archived=${archived}`) });
export const useResource = (id: string) => useQuery({ queryKey: kbKeys.resource(id), queryFn: () => api<Resource>(`/resources/${id}`) });
export const useBookmarks = (p: Record<string, string> = {}) => useQuery({ queryKey: kbKeys.bookmarks(p), queryFn: () => api<Bookmark[]>(`/bookmarks${qs(p)}`) });
export const useBooks = (p: Record<string, string> = {}) => useQuery({ queryKey: kbKeys.books(p), queryFn: () => api<Book[]>(`/books${qs(p)}`) });
export const useBook = (id: string) => useQuery({ queryKey: kbKeys.book(id), queryFn: () => api<Book>(`/books/${id}`) });

export function useSearch(q: string, types: SearchEntity[] = []) {
  const query = q.trim();
  const t = types.join(",");
  return useQuery({
    queryKey: kbKeys.search(query, t),
    queryFn: () => api<SearchResult[]>(`/search${qs({ q: query, types: t, limit: "12" })}`),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

/* ---------- mutations ---------- */
function useKbMutation<V, R>(fn: (v: V) => Promise<R>, alsoInvalidate: readonly (readonly string[])[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: kbKeys.all }), ...alsoInvalidate.map((k) => qc.invalidateQueries({ queryKey: k }))]),
  });
}

export const useCreateNote = () => useKbMutation((v: CreateNoteInput) => api<Note>("/notes", { method: "POST", json: v }));
export const useConvertInboxToNote = () => useKbMutation((inboxId: string) => api<Note>(`/inbox/${inboxId}/convert-to-note`, { method: "POST" }), [["inbox"]]);

/** Autosave: updates the cached note without refetching it (the editor owns the live content). */
export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive, ...v }: UpdateNoteInput & { id: string; keepalive?: boolean }) =>
      api<Note>(`/notes/${id}`, { method: "PATCH", json: v, keepalive }),
    onSuccess: (note) => {
      qc.setQueryData(kbKeys.note(note.id), note);
      void qc.invalidateQueries({ queryKey: ["kb", "notes"] });
      void qc.invalidateQueries({ queryKey: ["kb", "backlinks"] });
    },
  });
}

export const useSetTags = () =>
  useKbMutation(({ entity, id, tagIds }: { entity: Taggable; id: string; tagIds: string[] }) =>
    api<{ tagIds: string[] }>(`/${entity}s/${id}/tags`, { method: "PUT", json: { tagIds } }), [["para"]]);
export const useCreateTag = () => useKbMutation((v: { name: string; color?: string | null }) => api<Tag>("/tags", { method: "POST", json: v }));
export const useUpdateTag = () => useKbMutation(({ id, ...v }: { id: string; name?: string; color?: string | null }) => api<Tag>(`/tags/${id}`, { method: "PATCH", json: v }));
export const useDeleteTag = () => useKbMutation((id: string) => api<void>(`/tags/${id}`, { method: "DELETE" }), [["para"]]);

export const useCreateNotebook = () => useKbMutation((v: { name: string; description?: string | null }) => api<Notebook>("/notebooks", { method: "POST", json: v }));
export const useUpdateNotebook = () => useKbMutation(({ id, ...v }: { id: string; name?: string; archived?: boolean }) => api<Notebook>(`/notebooks/${id}`, { method: "PATCH", json: v }));
export const useCreateResource = () => useKbMutation((v: { name: string; description?: string | null; areaId?: string | null }) => api<Resource>("/resources", { method: "POST", json: v }));
export const useUpdateResource = () =>
  useKbMutation(({ id, ...v }: { id: string; name?: string; description?: string | null; areaId?: string | null; archived?: boolean }) => api<Resource>(`/resources/${id}`, { method: "PATCH", json: v }));

export const useCreateBookmark = () => useKbMutation((v: CreateBookmarkInput) => api<Bookmark>("/bookmarks", { method: "POST", json: v }));
export const useUpdateBookmark = () => useKbMutation(({ id, ...v }: UpdateBookmarkInput & { id: string }) => api<Bookmark>(`/bookmarks/${id}`, { method: "PATCH", json: v }));
export const useCreateBook = () => useKbMutation((v: CreateBookInput) => api<Book>("/books", { method: "POST", json: v }));
export const useUpdateBook = () => useKbMutation(({ id, ...v }: UpdateBookInput & { id: string }) => api<Book>(`/books/${id}`, { method: "PATCH", json: v }));

/** Generic soft delete for knowledge entities (trash), refreshing PARA too (shared trash view). */
export const useTrashKb = () =>
  useKbMutation(({ entity, id }: { entity: "note" | "notebook" | "resource" | "bookmark" | "book"; id: string }) => api<void>(`/${ENTITY_PATH[entity]}/${id}`, { method: "DELETE" }), [["para"]]);

/** Multipart upload (not JSON): validated server-side by magic bytes. */
export async function uploadFile(file: File): Promise<StoredFile> {
  const form = new FormData();
  form.append("file", file);
  if (!isOnline()) throw new NetworkError();
  const res = await fetch("/api/files", { method: "POST", body: form, credentials: "same-origin", redirect: "manual" }).catch((err: unknown) => {
    if (err instanceof TypeError) markOffline();
    throw err instanceof TypeError ? new NetworkError() : err;
  });
  const body = (await res.json().catch(() => null)) as { data?: StoredFile; error?: { code: string; message: string } } | null;
  if (!res.ok || !body?.data) throw new ApiError(res.status, body && body.error ? { error: body.error as never } : null);
  return body.data;
}
