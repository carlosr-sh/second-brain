import { BookMarkedIcon, BookmarkIcon, BookOpenIcon, CheckIcon, ExternalLinkIcon, HashIcon, LibraryBigIcon, NotebookTabsIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBookmarks, useBooks, useCreateBookmark, useCreateNotebook, useCreateResource, useCreateTag, useDeleteTag, useNotebooks, useNotes,
  useResource, useResources, useTags, useTrashKb, useUpdateBookmark, useUpdateTag,
} from "@/features/knowledge/queries";
import { TagPicker } from "@/features/knowledge/tag-picker";
import { BookCard } from "@/features/knowledge/books";
import { useAreas } from "@/features/para/queries";
import { Page, PageHeader } from "@/layout/page";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast-error";

const onError = (e: unknown) => toastError(e, "Erro");

/** Single-line "name + Enter" create form used by several pages. */
function InlineCreate({ placeholder, onCreate, pending }: { placeholder: string; onCreate: (v: string, reset: () => void) => void; pending?: boolean }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onCreate(value.trim(), () => setValue(""));
  };
  return (
    <form onSubmit={submit} className="mb-6 flex max-w-md gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={200} />
      <Button type="submit" variant="brand" disabled={pending || !value.trim()}><PlusIcon /> Criar</Button>
    </form>
  );
}

/* ---------------- Notebooks ---------------- */
export function NotebooksPage() {
  const notebooks = useNotebooks();
  const create = useCreateNotebook();
  return (
    <Page wide>
      <PageHeader title="Cadernos" description="Coleções de notas por formato ou finalidade (reuniões, ideias, diário de estudos) — independentes do PARA." />
      <InlineCreate placeholder="Novo caderno" pending={create.isPending} onCreate={(name, reset) => create.mutate({ name }, { onSuccess: reset, onError })} />
      {notebooks.isPending ? <Skeleton className="h-32" /> : !notebooks.data?.length ? <EmptyState icon={NotebookTabsIcon} title="Nenhum caderno" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.data.map((n) => (
            <Link key={n.id} to={`/notes?notebook=${n.id}`} className="rounded-xl border bg-card p-4 hover:border-brand/50" data-testid="notebook-card">
              <span className="flex items-center gap-2 font-medium"><NotebookTabsIcon className="size-4 text-brand" />{n.name}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{n.noteCount} nota(s)</span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ---------------- Tags ---------------- */
export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const del = useDeleteTag();
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  return (
    <Page>
      <PageHeader title="Tags" description="Etiquetas transversais: ligam notas, tarefas, projetos, links e livros de qualquer lugar do PARA." />
      <InlineCreate placeholder="Nova tag" pending={create.isPending} onCreate={(name, reset) => create.mutate({ name }, { onSuccess: reset, onError })} />
      {tags.isPending ? <Skeleton className="h-32" /> : !tags.data?.length ? <EmptyState icon={HashIcon} title="Nenhuma tag" /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {tags.data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5" data-testid="tag-row">
              <HashIcon className="size-4 text-muted-foreground" />
              <input
                defaultValue={t.name}
                aria-label={`Renomear tag ${t.name}`}
                onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && update.mutate({ id: t.id, name: e.target.value.trim() }, { onError })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:underline"
              />
              <Link to={`/notes?tag=${t.id}`} className="text-xs text-brand hover:underline">{t.usage} uso(s)</Link>
              <Button variant="ghost" size="icon-sm" aria-label={`Excluir tag ${t.name}`} onClick={() => setConfirm(t)}><Trash2Icon /></Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Excluir tag?"
        description={`A tag “${confirm?.name}” será removida de todos os itens. Os itens em si não são apagados.`}
        confirmLabel="Excluir tag" pending={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id, { onSuccess: () => setConfirm(null), onError })}
      />
    </Page>
  );
}

/* ---------------- Resources ---------------- */
export function ResourcesPage() {
  const resources = useResources();
  const create = useCreateResource();
  const areas = useAreas();
  const areaName = new Map((areas.data ?? []).map((a) => [a.id, a.name]));
  return (
    <Page wide>
      <PageHeader title="Recursos" description="O “R” do PARA: temas de interesse e material de referência — notas, links e livros por assunto." />
      <InlineCreate placeholder="Novo recurso (ex.: TypeScript, Nutrição)" pending={create.isPending} onCreate={(name, reset) => create.mutate({ name }, { onSuccess: reset, onError })} />
      {resources.isPending ? <Skeleton className="h-32" /> : !resources.data?.length ? <EmptyState icon={LibraryBigIcon} title="Nenhum recurso" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.data.map((r) => (
            <Link key={r.id} to={`/resources/${r.id}`} className="rounded-xl border bg-card p-4 hover:border-brand/50" data-testid="resource-card">
              <span className="flex items-center gap-2 font-medium"><LibraryBigIcon className="size-4 text-brand" />{r.name}</span>
              {r.areaId && <span className="mt-1 block text-xs text-muted-foreground">{areaName.get(r.areaId)}</span>}
              <span className="mt-2 block text-xs text-muted-foreground">{r.counts.notes} nota(s) · {r.counts.bookmarks} link(s) · {r.counts.books} livro(s)</span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

export function ResourceDetailPage() {
  const { id = "" } = useParams();
  const resource = useResource(id);
  const notes = useNotes({ resourceId: id });
  const bookmarks = useBookmarks({ resourceId: id });
  const books = useBooks({ resourceId: id });
  if (resource.isPending) return <Page><Skeleton className="h-40" /></Page>;
  if (!resource.data) return <Page><EmptyState icon={LibraryBigIcon} title="Recurso não encontrado" /></Page>;
  return (
    <Page wide>
      <Link to="/resources" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← Recursos</Link>
      <PageHeader title={resource.data.name} description={resource.data.description ?? undefined} />
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notas</h2>
          {(notes.data ?? []).map((n) => (
            <Link key={n.id} to={`/notes/${n.id}`} className="block rounded-lg border bg-card px-4 py-3 hover:border-brand/50">
              <span className="text-sm font-medium">{n.title || "Sem título"}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{n.excerpt}</span>
            </Link>
          ))}
          {!notes.data?.length && <p className="text-sm text-muted-foreground">Mova notas para este recurso pelo seletor “Local PARA” da nota.</p>}
        </section>
        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Links</h2>
          {(bookmarks.data ?? []).map((b) => <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-brand hover:underline">{b.title}</a>)}
          <h2 className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Livros</h2>
          {(books.data ?? []).map((b) => <span key={b.id} className="block text-sm">{b.title}</span>)}
        </section>
      </div>
    </Page>
  );
}

/* ---------------- Bookmarks ---------------- */
export function BookmarksPage() {
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const bookmarks = useBookmarks(filter === "unread" ? { unread: "true" } : {});
  const resources = useResources();
  const create = useCreateBookmark();
  const update = useUpdateBookmark();
  const trash = useTrashKb();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [resourceId, setResourceId] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    let fallback = "";
    try { fallback = new URL(full).hostname; } catch { return toast.error("Endereço inválido"); }
    create.mutate({ url: full, title: title.trim() || fallback, resourceId: resourceId || null }, { onSuccess: () => { setUrl(""); setTitle(""); }, onError });
  };

  return (
    <Page wide>
      <PageHeader title="Links" description="Bookmarks e leitura posterior. Marque como lido quando terminar." />
      <form onSubmit={submit} className="mb-6 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Endereço" required inputMode="url" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" aria-label="Título" maxLength={200} />
        <NativeSelect aria-label="Recurso" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
          <option value="">Sem recurso</option>
          {(resources.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </NativeSelect>
        <Button type="submit" variant="brand" disabled={create.isPending || !url.trim()}><PlusIcon /> Salvar</Button>
      </form>
      <Segmented className="mb-4" label="Filtro" value={filter} onChange={setFilter} options={[{ value: "unread", label: "Para ler" }, { value: "all", label: "Todos" }]} />
      {bookmarks.isPending ? <Skeleton className="h-32" /> : !bookmarks.data?.length ? <EmptyState icon={BookmarkIcon} title={filter === "unread" ? "Nada para ler" : "Nenhum link"} /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {bookmarks.data.map((b) => (
            <li key={b.id} className="flex items-start gap-3 px-4 py-3" data-testid="bookmark-row">
              <div className="min-w-0 flex-1">
                <a href={b.url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 text-sm font-medium hover:underline", b.readAt && "text-muted-foreground")}>
                  {b.title} <ExternalLinkIcon className="size-3" />
                </a>
                <span className="block truncate text-xs text-muted-foreground">{new URL(b.url).hostname} · {formatRelative(b.createdAt)}</span>
                <div className="mt-1"><TagPicker entity="bookmark" id={b.id} tagIds={b.tagIds} /></div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-pressed={b.isFavorite} aria-label="Favorito" onClick={() => update.mutate({ id: b.id, isFavorite: !b.isFavorite }, { onError })} className={cn(b.isFavorite && "text-amber-500")}><StarIcon /></Button>
              <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: b.id, read: !b.readAt }, { onError })}><CheckIcon /> {b.readAt ? "Lido" : "Marcar lido"}</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Mover para a lixeira" onClick={() => trash.mutate({ entity: "bookmark", id: b.id }, { onError })}><Trash2Icon /></Button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/* ---------------- Bookshelf ---------------- */
const SHELVES = [
  { value: "reading", label: "Lendo", icon: <BookOpenIcon /> },
  { value: "want_to_read", label: "Quero ler" },
  { value: "finished", label: "Lidos" },
  { value: "abandoned", label: "Abandonados" },
] as const;

export function BookshelfPage() {
  const [shelf, setShelf] = useState<(typeof SHELVES)[number]["value"]>("reading");
  const books = useBooks();
  const [creating, setCreating] = useState(false);
  const list = (books.data ?? []).filter((b) => b.status === shelf);
  return (
    <Page wide>
      <PageHeader title="Estante" description="Livros lidos, em leitura e na fila — com notas de leitura conectadas ao resto do seu conhecimento." actions={<Button variant="brand" size="sm" onClick={() => setCreating(true)}><PlusIcon /> Livro</Button>} />
      <Segmented className="mb-5" label="Prateleira" value={shelf} onChange={setShelf}
        options={SHELVES.map((s) => ({ value: s.value, label: <>{s.label} <Badge className="ml-1">{(books.data ?? []).filter((b) => b.status === s.value).length}</Badge></> }))} />
      {books.isPending ? <Skeleton className="h-40" /> : !list.length ? <EmptyState icon={BookMarkedIcon} title="Prateleira vazia" /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{list.map((b) => <BookCard key={b.id} book={b} />)}</div>
      )}
      {creating && <BookCard.Form open onOpenChange={setCreating} defaults={{ status: shelf }} />}
    </Page>
  );
}
