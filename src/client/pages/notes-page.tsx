import {
  ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, CheckIcon, CloudOffIcon, LinkIcon, LoaderIcon, MoreHorizontalIcon, PinIcon,
  PlusIcon, SearchIcon, StarIcon, StickyNoteIcon, Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { Note } from "@shared/knowledge";
import { UUID_REGEX } from "@shared/uuid";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/ui/tooltip";
import { NoteEditor } from "@/features/knowledge/editor/note-editor";
import { useBacklinks, useCreateNote, useNote, useNotebooks, useNotes, useResources, useSaveNote, useTags, useTrashKb } from "@/features/knowledge/queries";
import { TagPicker } from "@/features/knowledge/tag-picker";
import { useAutosave, type SaveStatus } from "@/features/knowledge/use-autosave";
import { useRestoreEntity } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotesPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const notebook = params.get("notebook") ?? "";
  const tag = params.get("tag") ?? "";
  const navigate = useNavigate();
  const create = useCreateNote();

  const newNote = () =>
    create.mutate({ title: "", ...(notebook ? { notebookId: notebook } : {}), ...(tag ? { tagIds: [tag] } : {}) }, {
      onSuccess: (n) => navigate({ pathname: `/notes/${n.id}`, search: params.toString() }),
    });

  return (
    <div className="flex h-full">
      <aside className={cn("w-full shrink-0 flex-col border-r md:flex md:w-80", id ? "hidden" : "flex")}>
        <NoteList activeId={id} notebook={notebook} tag={tag} onFilter={(k, v) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true })} onNew={newNote} />
      </aside>
      <section className={cn("min-w-0 flex-1 overflow-y-auto", !id && "hidden md:block")}>
        {id ? <NoteView key={id} id={id} /> : (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState icon={StickyNoteIcon} title="Selecione ou crie uma nota" description="Notas se conectam com [[links]]. Tudo é pesquisável com Ctrl K." action={<Button size="sm" variant="brand" onClick={newNote}><PlusIcon /> Nova nota</Button>} />
          </div>
        )}
      </section>
    </div>
  );
}

function NoteList({ activeId, notebook, tag, onFilter, onNew }: { activeId?: string; notebook: string; tag: string; onFilter: (k: string, v: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState("");
  const [params] = useSearchParams();
  const notes = useNotes({ ...(notebook ? { notebookId: notebook } : {}), ...(tag ? { tagId: tag } : {}) });
  const notebooks = useNotebooks();
  const tags = useTags();
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (notes.data ?? []).filter((n) => !f || n.title.toLowerCase().includes(f) || n.excerpt.toLowerCase().includes(f));
  }, [notes.data, filter]);

  return (
    <>
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-lg font-semibold">Notas</h1>
          <Button size="sm" variant="brand" onClick={onNew}><PlusIcon /> Nova</Button>
        </div>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar notas…" aria-label="Filtrar notas" className="h-8 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect aria-label="Caderno" value={notebook} onChange={(e) => onFilter("notebook", e.target.value)}>
            <option value="">Todos os cadernos</option>
            {(notebooks.data ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Tag" value={tag} onChange={(e) => onFilter("tag", e.target.value)}>
            <option value="">Todas as tags</option>
            {(tags.data ?? []).map((t) => <option key={t.id} value={t.id}>#{t.name}</option>)}
          </NativeSelect>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Lista de notas">
        {notes.isPending && <li className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</li>}
        {shown.map((n) => (
          <li key={n.id}>
            <Link
              to={{ pathname: `/notes/${n.id}`, search: params.toString() }}
              className={cn("block border-b px-4 py-3 hover:bg-accent/50", n.id === activeId && "bg-accent")}
              data-testid="note-list-item"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {n.isPinned && <PinIcon className="size-3 text-brand" />}
                <span className="truncate">{n.title || "Sem título"}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.excerpt || "Vazia"}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground/80">{formatRelative(n.updatedAt)}</span>
            </Link>
          </li>
        ))}
        {!notes.isPending && !shown.length && <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma nota.</li>}
      </ul>
    </>
  );
}

function StatusIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, [React.ReactNode, string]> = {
    idle: [null, ""],
    pending: [<LoaderIcon key="p" className="size-3" />, "Editando…"],
    saving: [<LoaderIcon key="s" className="size-3 animate-spin" />, "Salvando…"],
    saved: [<CheckIcon key="ok" className="size-3" />, "Salvo"],
    error: [<CloudOffIcon key="e" className="size-3 text-destructive" />, "Erro ao salvar — tentaremos de novo"],
  };
  const [icon, label] = map[status];
  return <span role="status" aria-live="polite" className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="save-status">{icon}{label}</span>;
}

function NoteView({ id }: { id: string }) {
  const valid = UUID_REGEX.test(id);
  const note = useNote(valid ? id : undefined); // impossible ids never hit the API
  if (!valid) return <div className="p-8"><EmptyState icon={StickyNoteIcon} title="Nota não encontrada" /></div>;
  if (note.isPending) return <div className="mx-auto max-w-3xl space-y-4 p-8"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;
  if (!note.data) return <div className="p-8"><EmptyState icon={StickyNoteIcon} title="Nota não encontrada" /></div>;
  return <NoteDetail note={note.data} />;
}

function NoteDetail({ note }: { note: Note }) {
  const { queue, flush, status } = useAutosave(note.id);
  const [title, setTitle] = useState(note.title);
  const save = useSaveNote();
  const trash = useTrashKb();
  const restore = useRestoreEntity();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const notebooks = useNotebooks();
  const resources = useResources();
  const { projects, areas } = useParaLookup();
  const location = note.projectId ? `project:${note.projectId}` : note.areaId ? `area:${note.areaId}` : note.resourceId ? `resource:${note.resourceId}` : "";
  const setMeta = (patch: Parameters<typeof save.mutate>[0]) => { flush(); save.mutate(patch, { onError: () => toast.error("Não foi possível salvar") }); };

  const moveLocation = (value: string) => {
    const [kind, ref] = value.split(":");
    setMeta({ id: note.id, projectId: kind === "project" ? ref : null, areaId: kind === "area" ? ref : null, resourceId: kind === "resource" ? ref : null });
  };

  const remove = () => {
    flush();
    trash.mutate({ entity: "note", id: note.id }, {
      onSuccess: () => {
        navigate({ pathname: "/notes", search: params.toString() });
        toast("Nota movida para a lixeira", { action: { label: "Desfazer", onClick: () => restore.mutate({ entity: "note", id: note.id }) } });
      },
    });
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <div className="mb-4 flex items-center gap-2">
        <Link to={{ pathname: "/notes", search: params.toString() }} className="inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"><ArrowLeftIcon className="size-4" /> Notas</Link>
        <StatusIndicator status={status} />
        <div className="ml-auto flex items-center gap-1">
          <Hint label={note.isPinned ? "Desafixar" : "Fixar no topo"}>
            <Button variant="ghost" size="icon-sm" aria-pressed={note.isPinned} aria-label="Fixar" onClick={() => setMeta({ id: note.id, isPinned: !note.isPinned })} className={cn(note.isPinned && "text-brand")}><PinIcon /></Button>
          </Hint>
          <Hint label={note.isFavorite ? "Remover dos favoritos" : "Favoritar"}>
            <Button variant="ghost" size="icon-sm" aria-pressed={note.isFavorite} aria-label="Favoritar" onClick={() => setMeta({ id: note.id, isFavorite: !note.isFavorite })} className={cn(note.isFavorite && "text-amber-500")}><StarIcon /></Button>
          </Hint>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Mais ações"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setMeta({ id: note.id, archived: !note.archivedAt })}>{note.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {note.archivedAt ? "Desarquivar" : "Arquivar"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={remove} className="text-destructive"><Trash2Icon className="text-destructive!" /> Mover para a lixeira</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value }); }}
        placeholder="Sem título"
        aria-label="Título da nota"
        maxLength={300}
        className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
      />

      <div className="mt-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <NativeSelect aria-label="Caderno da nota" value={note.notebookId ?? ""} onChange={(e) => setMeta({ id: note.id, notebookId: e.target.value || null })} className="w-44">
          <option value="">Sem caderno</option>
          {(notebooks.data ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Local PARA da nota" value={location} onChange={(e) => moveLocation(e.target.value)} className="w-52">
          <option value="">Sem local PARA</option>
          {projects.length > 0 && <optgroup label="Projetos">{projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}</optgroup>}
          {areas.length > 0 && <optgroup label="Áreas">{areas.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}</optgroup>}
          {(resources.data ?? []).length > 0 && <optgroup label="Recursos">{resources.data!.map((r) => <option key={r.id} value={`resource:${r.id}`}>{r.name}</option>)}</optgroup>}
        </NativeSelect>
        <TagPicker entity="note" id={note.id} tagIds={note.tagIds} />
      </div>

      <NoteEditor noteId={note.id} initialContent={note.content} onChange={(content) => queue({ content })} />

      <Backlinks noteId={note.id} />
      <p className="mt-6 text-xs text-muted-foreground">{note.wordCount} palavra(s) · editada {formatRelative(note.updatedAt)}</p>
    </article>
  );
}

function Backlinks({ noteId }: { noteId: string }) {
  const backlinks = useBacklinks(noteId);
  const [params] = useSearchParams();
  if (!backlinks.data?.length) return null;
  return (
    <section aria-label="Backlinks" className="mt-10 rounded-xl border bg-card p-4" data-testid="backlinks">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"><LinkIcon className="size-3.5" /> Mencionada em {backlinks.data.length}</h2>
      <ul className="space-y-2">
        {backlinks.data.map((b) => (
          <li key={b.id}>
            <Link to={{ pathname: `/notes/${b.id}`, search: params.toString() }} className="block rounded-md px-2 py-1.5 hover:bg-accent">
              <span className="text-sm font-medium">{b.title || "Sem título"}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{b.excerpt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
