import { BookIcon, ImagePlusIcon, PlusIcon, StarIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BOOK_STATUS } from "@shared/enums";
import { createBookSchema, type Book, type CreateBookInput } from "@shared/knowledge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useZodForm } from "@/features/forms/use-form";
import { cn } from "@/lib/utils";
import { useCreateBook, useCreateNote, useNotes, useTrashKb, useUpdateBook, uploadFile } from "./queries";
import { TagPicker } from "./tag-picker";
import { toastError } from "@/lib/toast-error";

const STATUS_LABEL: Record<Book["status"], string> = { want_to_read: "Quero ler", reading: "Lendo", finished: "Lido", abandoned: "Abandonado" };

function Stars({ value, onChange, size = "size-4" }: { value: number | null; onChange?: (v: number | null) => void; size?: string }) {
  return (
    <div className="flex" role={onChange ? "radiogroup" : undefined} aria-label="Avaliação">
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <StarIcon className={cn(size, (value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} estrela(s)`} onClick={() => onChange(value === n ? null : n)}>{icon}</button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
}

function Cover({ book, className }: { book: Pick<Book, "title" | "coverFileId">; className?: string }) {
  return book.coverFileId ? (
    <img src={`/api/files/${book.coverFileId}`} alt={`Capa de ${book.title}`} className={cn("aspect-[2/3] w-full rounded-md border object-cover", className)} loading="lazy" />
  ) : (
    <div className={cn("flex aspect-[2/3] w-full items-center justify-center rounded-md border bg-gradient-to-br from-brand-soft to-muted p-3 text-center text-sm font-medium", className)}>{book.title}</div>
  );
}

function BookCardImpl({ book }: { book: Book }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group text-left" data-testid="book-card">
        <Cover book={book} className="transition-transform group-hover:-translate-y-0.5" />
        <span className="mt-2 line-clamp-2 block text-sm font-medium">{book.title}</span>
        {book.author && <span className="block truncate text-xs text-muted-foreground">{book.author}</span>}
        {book.rating && <Stars value={book.rating} size="size-3" />}
      </button>
      {open && <BookFormDialog open onOpenChange={setOpen} book={book} />}
    </>
  );
}

function BookFormDialog({ open, onOpenChange, book, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; book?: Book; defaults?: Partial<CreateBookInput> }) {
  const ids = useId();
  const create = useCreateBook();
  const update = useUpdateBook();
  const trash = useTrashKb();
  const [cover, setCover] = useState<string | null>(book?.coverFileId ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useZodForm(
    createBookSchema,
    {
      title: book?.title ?? "", author: book?.author ?? "", status: book?.status ?? defaults?.status ?? "want_to_read",
      rating: book?.rating ?? null, pageCount: book?.pageCount ? String(book.pageCount) : "", startedOn: book?.startedOn ?? "",
      finishedOn: book?.finishedOn ?? "", summary: book?.summary ?? "",
    },
    (f): CreateBookInput => ({
      title: f.title, author: f.author.trim() || null, status: f.status as Book["status"], rating: f.rating,
      pageCount: f.pageCount ? Number(f.pageCount) : null, startedOn: f.startedOn || null, finishedOn: f.finishedOn || null,
      summary: f.summary.trim() || null, coverFileId: cover,
    }),
  );
  const onError = (e: unknown) => toastError(e, "Não foi possível salvar");
  const submit = () => {
    const data = form.validate();
    if (!data) return;
    if (book) update.mutate({ id: book.id, ...data }, { onSuccess: () => onOpenChange(false), onError });
    else create.mutate(data, { onSuccess: () => onOpenChange(false), onError });
  };
  const pickCover = async (file?: File) => {
    if (!file) return;
    try {
      setCover((await uploadFile(file)).id);
    } catch (e) {
      onError(e);
    }
  };
  const v = form.values;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6%] max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{book ? "Livro" : "Novo livro"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <Cover book={{ title: v.title || "Capa", coverFileId: cover }} />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}><ImagePlusIcon /> Capa</Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickCover(e.target.files?.[0])} />
          </div>
          <form id={`${ids}-form`} onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate className="grid gap-3">
            <Field id={`${ids}-title`} label="Título" error={form.errors.title}><Input id={`${ids}-title`} autoFocus value={v.title} onChange={(e) => form.set("title", e.target.value)} maxLength={200} /></Field>
            <Field id={`${ids}-author`} label="Autor(a)"><Input id={`${ids}-author`} value={v.author} onChange={(e) => form.set("author", e.target.value)} maxLength={200} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${ids}-status`} label="Status">
                <NativeSelect id={`${ids}-status`} value={v.status} onChange={(e) => form.set("status", e.target.value as Book["status"])}>
                  {BOOK_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </NativeSelect>
              </Field>
              <Field id={`${ids}-pages`} label="Páginas" error={form.errors.pageCount}><Input id={`${ids}-pages`} type="number" min={1} value={v.pageCount} onChange={(e) => form.set("pageCount", e.target.value)} /></Field>
              <Field id={`${ids}-start`} label="Começou em" error={form.errors.startedOn}><Input id={`${ids}-start`} type="date" value={v.startedOn} onChange={(e) => form.set("startedOn", e.target.value)} className="dark:[color-scheme:dark]" /></Field>
              <Field id={`${ids}-end`} label="Terminou em" error={form.errors.finishedOn}><Input id={`${ids}-end`} type="date" value={v.finishedOn} onChange={(e) => form.set("finishedOn", e.target.value)} className="dark:[color-scheme:dark]" /></Field>
            </div>
            <div className="grid gap-1.5"><span className="text-xs text-muted-foreground">Avaliação</span><Stars value={v.rating} onChange={(r) => form.set("rating", r)} /></div>
            <Field id={`${ids}-summary`} label="Resumo / impressões"><Textarea id={`${ids}-summary`} value={v.summary} onChange={(e) => form.set("summary", e.target.value)} maxLength={20_000} /></Field>
          </form>
        </div>
        {book && (
          <>
            <TagPicker entity="book" id={book.id} tagIds={book.tagIds} />
            <ReadingNotes book={book} onNavigate={() => onOpenChange(false)} />
          </>
        )}
        <DialogFooter className="sm:justify-between">
          {book ? <Button variant="ghost" size="sm" onClick={() => trash.mutate({ entity: "book", id: book.id }, { onSuccess: () => onOpenChange(false) })}>Mover para a lixeira</Button> : <span />}
          <Button type="submit" form={`${ids}-form`} variant="brand" disabled={create.isPending || update.isPending}>{book ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadingNotes({ book, onNavigate }: { book: Book; onNavigate: () => void }) {
  const notes = useNotes({ bookId: book.id });
  const create = useCreateNote();
  const navigate = useNavigate();
  const go = (id: string) => { onNavigate(); navigate(`/notes/${id}`); };
  return (
    <section aria-label="Notas de leitura" className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"><BookIcon className="size-3.5" /> Notas de leitura</h3>
        <Button variant="ghost" size="sm" onClick={() => create.mutate({ title: `Notas — ${book.title}`, bookId: book.id }, { onSuccess: (n) => go(n.id) })}><PlusIcon /> Nova nota</Button>
      </div>
      {(notes.data ?? []).map((n) => (
        <button key={n.id} type="button" onClick={() => go(n.id)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">{n.title || "Sem título"}</button>
      ))}
      {!notes.data?.length && <p className="px-2 text-sm text-muted-foreground">Nenhuma nota ainda.</p>}
    </section>
  );
}

export const BookCard = Object.assign(BookCardImpl, { Form: BookFormDialog });
