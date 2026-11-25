import { ArrowRightIcon, FlameIcon, FolderKanbanIcon, InboxIcon, LandmarkIcon, StickyNoteIcon, SunIcon } from "lucide-react";
import { formatBRL } from "@shared/money";
import { isoDateIn } from "@shared/time";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccounts, useHabitLog, useHabits, useMonthlySummary } from "@/features/personal/queries";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { greetingFor } from "@shared/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaptureInbox, useInboxCount, useInboxItems } from "@/features/inbox/hooks";
import { InboxList } from "@/features/inbox/inbox-list";
import { splitCapture } from "@/features/inbox/quick-capture-dialog";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { useNotes } from "@/features/knowledge/queries";
import { OPEN_TASK_STATUSES } from "@/features/para/labels";
import { useProjects, useTasks } from "@/features/para/queries";
import { useToday } from "@/features/para/use-today";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { TaskRow } from "@/features/tasks/task-row";
import { Progress } from "@/components/ui/progress";
import { Page } from "@/layout/page";
import { formatLongDate } from "@/lib/format";

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function InlineCapture() {
  const [text, setText] = useState("");
  const capture = useCaptureInbox();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    capture.mutate(splitCapture(text), {
      onSuccess: () => {
        setText("");
        toast.success("Capturado na Inbox");
      },
    });
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="O que está na sua cabeça?" aria-label="Captura rápida" maxLength={10_000} />
      <Button type="submit" variant="brand" disabled={!text.trim() || capture.isPending}>
        Capturar
      </Button>
    </form>
  );
}

function InboxWidget() {
  const count = useInboxCount();
  const items = useInboxItems("open");
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InboxIcon className="size-4" /> Inbox
          {count.data !== undefined && <Badge variant={count.data ? "brand" : "default"}>{count.data}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/inbox">
            Abrir <ArrowRightIcon />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.isPending ? (
          <Skeleton className="h-24" />
        ) : items.data?.length ? (
          <InboxList items={items.data.slice(0, 5)} compact />
        ) : (
          <p className="text-muted-foreground">Inbox zerada. Mente livre.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TodayWidget() {
  const today = useToday();
  const tasks = useTasks({ status: OPEN_TASK_STATUSES.join(","), dueTo: today });
  const list = tasks.data ?? [];
  const overdue = list.filter((t) => t.dueDate! < today).length;
  return (
    <Card className="md:col-span-2" data-testid="today-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SunIcon className="size-4" /> Hoje
          {overdue > 0 && <Badge variant="outline" className="text-destructive">{overdue} atrasada(s)</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild><Link to="/tasks">Tarefas <ArrowRightIcon /></Link></Button>
      </CardHeader>
      <CardContent className="-mx-2">
        {tasks.isPending ? <Skeleton className="h-24" /> : list.length ? (
          <ul className="divide-y">{list.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        ) : (
          <p className="px-2 text-muted-foreground">Nada vencendo hoje.</p>
        )}
        <QuickAddTask defaults={{ dueDate: today }} placeholder="Adicionar para hoje…" />
      </CardContent>
    </Card>
  );
}

function RecentNotesWidget() {
  const notes = useNotes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><StickyNoteIcon className="size-4" /> Notas recentes</CardTitle>
        <Link to="/notes" className="text-xs text-brand hover:underline">Ver todas</Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {notes.isPending ? <Skeleton className="h-16" /> : notes.data?.length ? notes.data.slice(0, 5).map((n) => (
          <Link key={n.id} to={`/notes/${n.id}`} className="block truncate hover:underline">{n.title || "Sem título"}</Link>
        )) : <p className="text-muted-foreground">Nenhuma nota ainda.</p>}
      </CardContent>
    </Card>
  );
}

function HabitsTodayWidget() {
  const habits = useHabits();
  const log = useHabitLog();
  const today = isoDateIn(new Date());
  const list = habits.data ?? [];
  return (
    <Card data-testid="habits-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FlameIcon className="size-4" /> Hábitos de hoje</CardTitle>
        <Link to="/habits" className="text-xs text-brand hover:underline">Ver todos</Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {habits.isPending ? <Skeleton className="h-16" /> : list.length ? list.slice(0, 6).map((h) => {
          const count = h.logs.find((l) => l.date === today)?.count ?? 0;
          const done = h.frequency === "daily" ? count >= h.targetCount : count > 0;
          return (
            <label key={h.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
              <Checkbox checked={done} onCheckedChange={(v) => log.mutate({ id: h.id, date: today, count: v ? Math.max(1, h.frequency === "daily" ? h.targetCount : 1) : 0 })} aria-label={`${h.name} feito hoje`} />
              <span className={done ? "text-muted-foreground line-through" : ""}>{h.name}</span>
              {h.stats.currentStreak > 0 && <span className="ml-auto inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums"><FlameIcon className="size-3 text-brand" />{h.stats.currentStreak}</span>}
            </label>
          );
        }) : <p className="text-muted-foreground">Nenhum hábito ainda.</p>}
      </CardContent>
    </Card>
  );
}

function FinanceMonthWidget() {
  const summary = useMonthlySummary(1);
  const accounts = useAccounts();
  const m = summary.data?.[0];
  const total = (accounts.data ?? []).reduce((s, a) => s + a.balanceCents, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LandmarkIcon className="size-4" /> Mês financeiro</CardTitle>
        <Link to="/finance" className="text-xs text-brand hover:underline">Detalhes</Link>
      </CardHeader>
      <CardContent>
        {summary.isPending || accounts.isPending ? <Skeleton className="h-16" /> : !accounts.data?.length ? <p className="text-muted-foreground">Nenhuma conta criada.</p> : (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Saldo total</dt><dd className="text-right font-semibold tabular-nums">{formatBRL(total)}</dd>
            <dt className="text-muted-foreground">Receitas</dt><dd className="text-right tabular-nums">{formatBRL(m?.incomeCents ?? 0)}</dd>
            <dt className="text-muted-foreground">Despesas</dt><dd className="text-right tabular-nums">{formatBRL(m?.expenseCents ?? 0)}</dd>
            <dt className="text-muted-foreground">Resultado</dt><dd className="text-right font-medium tabular-nums">{formatBRL(m?.netCents ?? 0)}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveProjectsWidget() {
  const projects = useProjects({ status: "active" });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderKanbanIcon className="size-4" /> Projetos ativos</CardTitle>
        <Link to="/projects" className="text-xs text-brand hover:underline">Ver todos</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.isPending ? <Skeleton className="h-16" /> : projects.data?.length ? projects.data.slice(0, 5).map((p) => {
          const total = p.taskStats.open + p.taskStats.done;
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="block space-y-1.5 hover:underline">
              <span className="block truncate">{p.name}</span>
              {total > 0 && <Progress value={p.taskStats.done} max={total} label={`Progresso de ${p.name}`} />}
            </Link>
          );
        }) : <p className="text-muted-foreground">Nenhum projeto ativo.</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const now = useNow();
  return (
    <Page wide>
      <header className="mb-8">
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(now)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greetingFor(now)}.</h1>
      </header>
      <div className="mb-8 max-w-2xl">
        <InlineCapture />
        <p className="mt-2 text-xs text-muted-foreground">
          Dica: <KeysHint keys="c" /> captura de qualquer tela, <KeysHint keys="mod+k" /> abre os comandos.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TodayWidget />
        <ActiveProjectsWidget />
        <InboxWidget />
        <RecentNotesWidget />
        <HabitsTodayWidget />
        <FinanceMonthWidget />
      </div>
    </Page>
  );
}
