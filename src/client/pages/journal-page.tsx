import { ChevronLeftIcon, ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { addDays, addMonths, isoWeekday, isValidIsoDate } from "@shared/dates";
import type { JournalEntry, UpsertJournalInput } from "@shared/personal";
import { emptyDoc } from "@shared/rich-text";
import { isoDateIn } from "@shared/time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isDocumentReady } from "@/features/offline/document-ready";
import { NoteEditor } from "@/features/knowledge/editor/note-editor";
import { useAutosave } from "@/features/knowledge/use-autosave";
import { useJournalDay, useJournalRange, useSaveJournal } from "@/features/personal/queries";
import { cn } from "@/lib/utils";

const SCALE = ["Muito baixo", "Baixo", "Ok", "Bom", "Ótimo"];
const longDate = (d: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)).replace(/^./, (c) => c.toUpperCase());

function Scale({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} title={SCALE[n - 1]} aria-label={`${label}: ${SCALE[n - 1]}`}
          onClick={() => onChange(value === n ? null : n)}
          className={cn("size-7 rounded-md border text-xs tabular-nums transition-colors hover:bg-accent", value === n && "border-brand bg-brand-soft font-semibold text-brand")}>
          {n}
        </button>
      ))}
    </div>
  );
}

function MonthCalendar({ date }: { date: string }) {
  const [month, setMonth] = useState(`${date.slice(0, 7)}-01`);
  const end = addDays(addMonths(month, 1), -1);
  const entries = useJournalRange(month, end);
  const written = new Set((entries.data ?? []).map((e) => e.date));
  const today = isoDateIn(new Date());
  const cells = Array.from({ length: isoWeekday(month) }, () => null as string | null).concat(
    Array.from({ length: Number(end.slice(8)) }, (_, i) => addDays(month, i)),
  );
  return (
    <div className="w-64 shrink-0 rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeftIcon /></Button>
        <span className="text-sm font-medium capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T00:00:00Z`))}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><ChevronRightIcon /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
        {cells.map((d, i) =>
          d ? (
            <Link key={d} to={`/journal/${d}`} aria-label={`${d}${written.has(d) ? " (com registro)" : ""}`}
              className={cn("relative flex size-8 items-center justify-center rounded-md text-xs text-foreground hover:bg-accent", d === date && "bg-brand text-brand-foreground hover:bg-brand", d > today && "pointer-events-none opacity-30")}>
              {Number(d.slice(8))}
              {written.has(d) && <span className={cn("absolute bottom-1 size-1 rounded-full", d === date ? "bg-brand-foreground" : "bg-brand")} />}
            </Link>
          ) : <span key={`e${i}`} />,
        )}
      </div>
    </div>
  );
}

function Entry({ date, entry }: { date: string; entry: JournalEntry | null }) {
  const saveAsync = useSaveJournal().mutateAsync;
  const { queue, flush, status } = useAutosave<UpsertJournalInput>(date, (patch, { keepalive }) => saveAsync({ date, ...patch, keepalive }));
  const [title, setTitle] = useState(entry?.title ?? "");
  const [mood, setMood] = useState(entry?.mood ?? null);
  const [energy, setEnergy] = useState(entry?.energy ?? null);
  return (
    <div className="min-w-0 flex-1">
      <span role="status" aria-live="polite" className="text-xs text-muted-foreground" data-testid="save-status">
        {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Erro ao salvar" : status === "pending" ? "Editando…" : ""}
      </span>
      <input value={title} onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value || null }); }} placeholder="Título do dia (opcional)"
        aria-label="Título do registro" maxLength={300} className="mt-2 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
      <div className="mt-3 mb-4 flex flex-wrap gap-4">
        <Scale label="Humor" value={mood} onChange={(v) => { setMood(v); flush(); queue({ mood: v }); }} />
        <Scale label="Energia" value={energy} onChange={(v) => { setEnergy(v); flush(); queue({ energy: v }); }} />
      </div>
      <NoteEditor noteId={entry?.id ?? date} initialContent={entry?.content ?? emptyDoc()} onChange={(content) => queue({ content })} />
    </div>
  );
}

export function JournalPage() {
  const { date: param } = useParams();
  const today = isoDateIn(new Date());
  const navigate = useNavigate();
  const valid = !!param && isValidIsoDate(param);
  const date = valid ? param : today;
  const entry = useJournalDay(date);
  if (!valid) return <Navigate to={`/journal/${today}`} replace />;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <NotebookPenIcon className="size-5 text-brand" />
        <h1 className="text-xl font-semibold" data-testid="journal-date">{longDate(date)}</h1>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Dia anterior" onClick={() => navigate(`/journal/${addDays(date, -1)}`)}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/journal/${today}`)} disabled={date === today}>Hoje</Button>
          <Button variant="ghost" size="icon-sm" aria-label="Próximo dia" onClick={() => navigate(`/journal/${addDays(date, 1)}`)} disabled={date >= today}><ChevronRightIcon /></Button>
        </div>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row-reverse">
        <div className="hidden lg:block"><MonthCalendar date={date} /></div>
        {!isDocumentReady(entry) ? <Skeleton className="h-64 flex-1" /> : <Entry key={date} date={date} entry={entry.data ?? null} />}
      </div>
    </div>
  );
}
