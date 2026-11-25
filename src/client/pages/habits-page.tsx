import { ArchiveIcon, CheckIcon, FlameIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { addDays, isoWeekday } from "@shared/dates";
import { HABIT_FREQUENCY } from "@shared/enums";
import type { Habit } from "@shared/personal";
import { isoDateIn } from "@shared/time";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrashEntity } from "@/features/para/queries";
import { useCreateHabit, useHabitLog, useHabits, useUpdateHabit } from "@/features/personal/queries";
import { Page, PageHeader } from "@/layout/page";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast-error";

const onError = (e: unknown) => toastError(e, "Erro");
const FREQ_LABEL: Record<Habit["frequency"], string> = { daily: "por dia", weekly: "por semana", monthly: "por mês" };
const PERIOD_LABEL: Record<Habit["frequency"], [string, string]> = { daily: ["dia seguido", "dias seguidos"], weekly: ["semana seguida", "semanas seguidas"], monthly: ["mês seguido", "meses seguidos"] };
const WEEKS = 26;
const fmt = (d: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** 26-week calendar heatmap: one hue, light → dark (sequential), Monday-first columns. */
function Heatmap({ habit, today }: { habit: Habit; today: string }) {
  const counts = new Map(habit.logs.map((l) => [l.date, l.count]));
  const start = addDays(addDays(today, -isoWeekday(today)), -(WEEKS - 1) * 7);
  const target = habit.frequency === "daily" ? habit.targetCount : 1;
  const level = (n: number) => (n <= 0 ? 0 : n >= target * 2 && target > 1 ? 3 : n >= target ? 2 : 1);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
      <div role="img" aria-label={`Histórico de ${habit.name}: ${habit.logs.length} registro(s) nas últimas ${WEEKS} semanas`}
        className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" data-testid="heatmap">
        {cells.map((d) => {
          const n = counts.get(d) ?? 0;
          const future = d > today;
          return (
            <span key={d} title={future ? "" : `${fmt(d)}: ${n ? `${n}×` : "não feito"}`}
              className={cn("size-[11px] rounded-[3px]", future && "opacity-0")}
              style={{ background: `var(--viz-seq-${level(n)})` }} />
          );
        })}
      </div>
    </div>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const today = isoDateIn(new Date());
  const log = useHabitLog();
  const update = useUpdateHabit();
  const trash = useTrashEntity();
  const todayCount = habit.logs.find((l) => l.date === today)?.count ?? 0;
  const set = (count: number) => log.mutate({ id: habit.id, date: today, count: Math.max(0, count) }, { onError });
  const doneNow = habit.frequency === "daily" ? todayCount >= habit.targetCount : todayCount > 0;
  const [one, many] = PERIOD_LABEL[habit.frequency];
  return (
    <Card className="gap-3" data-testid="habit-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{habit.name}</h2>
          <p className="text-xs text-muted-foreground">
            Meta: {habit.targetCount}× {FREQ_LABEL[habit.frequency]} · neste período: {habit.stats.currentPeriodCount}/{habit.targetCount}
          </p>
        </div>
        {habit.targetCount > 1 && habit.frequency === "daily" ? (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Diminuir" onClick={() => set(todayCount - 1)} disabled={!todayCount}><MinusIcon /></Button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">{todayCount}</span>
            <Button variant={doneNow ? "brand" : "outline"} size="icon-sm" aria-label="Aumentar" onClick={() => set(todayCount + 1)}><PlusIcon /></Button>
          </div>
        ) : (
          <Button variant={doneNow ? "brand" : "outline"} size="sm" aria-pressed={doneNow} onClick={() => set(todayCount ? 0 : 1)} data-testid="habit-check">
            <CheckIcon /> {doneNow ? "Feito hoje" : "Marcar hoje"}
          </Button>
        )}
      </div>
      <Heatmap habit={habit} today={today} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1" data-testid="habit-streak"><FlameIcon className="size-4 text-brand" />{habit.stats.currentStreak} {habit.stats.currentStreak === 1 ? one : many}</span>
        <span className="text-muted-foreground">Recorde: {habit.stats.longestStreak}</span>
        <span className="text-muted-foreground">Taxa recente: {Math.round(habit.stats.completionRate * 100)}%</span>
        <div className="ml-auto flex">
          <Button variant="ghost" size="icon-sm" aria-label={`Arquivar ${habit.name}`} onClick={() => update.mutate({ id: habit.id, archived: true }, { onError })}><ArchiveIcon /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${habit.name}`} onClick={() => trash.mutate({ entity: "habit", id: habit.id }, { onError })}><Trash2Icon /></Button>
        </div>
      </div>
    </Card>
  );
}

export function HabitsPage() {
  const habits = useHabits();
  const create = useCreateHabit();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [target, setTarget] = useState("1");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), frequency, targetCount: Math.max(1, Number(target) || 1) }, { onSuccess: () => { setName(""); setTarget("1"); }, onError });
  };
  return (
    <Page wide>
      <PageHeader title="Hábitos" description="Pequenas ações repetidas. A sequência não quebra enquanto o período atual ainda está em aberto." />
      <form onSubmit={submit} className="mb-6 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[2fr_auto_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo hábito (ex.: Ler 20 minutos)" aria-label="Novo hábito" maxLength={200} />
        <Input type="number" min={1} max={100} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Vezes" className="w-20" />
        <NativeSelect aria-label="Frequência" value={frequency} onChange={(e) => setFrequency(e.target.value as Habit["frequency"])}>
          {HABIT_FREQUENCY.map((f) => <option key={f} value={f}>vez(es) {FREQ_LABEL[f]}</option>)}
        </NativeSelect>
        <Button type="submit" variant="brand" disabled={!name.trim() || create.isPending}><PlusIcon /> Criar</Button>
      </form>
      {habits.isPending ? <Skeleton className="h-48" /> : !habits.data?.length ? <EmptyState icon={FlameIcon} title="Nenhum hábito ainda" /> : (
        <div className="grid gap-4 lg:grid-cols-2">{habits.data.map((h) => <HabitCard key={h.id} habit={h} />)}</div>
      )}
    </Page>
  );
}
