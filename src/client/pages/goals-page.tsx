import { PlusIcon, TargetIcon } from "lucide-react";
import { useState } from "react";
import { GOAL_HORIZON } from "@shared/enums";
import type { Goal } from "@shared/para";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalFormDialog } from "@/features/forms/entity-forms";
import { GOAL_HORIZON_LABEL, GOAL_STATUS_LABEL } from "@/features/para/labels";
import { useGoals } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { Page, PageHeader } from "@/layout/page";
import { formatDueDate } from "@/lib/format";

export function GoalCard({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false);
  const { areaName } = useParaLookup();
  const today = useToday();
  return (
    <>
      <button type="button" onClick={() => setEditing(true)} className="grid gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-brand/50" data-testid="goal-card">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium break-words">{goal.title}</span>
          <Badge variant={goal.status === "achieved" ? "brand" : "outline"}>{GOAL_STATUS_LABEL[goal.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {goal.areaId && <span>{areaName.get(goal.areaId)}</span>}
          {goal.targetDate && <span>Prazo: {formatDueDate(goal.targetDate, today)}</span>}
        </div>
        {goal.progress.total > 0 ? (
          <div className="flex items-center gap-2">
            <Progress value={goal.progress.completed} max={goal.progress.total} label={`Progresso de ${goal.title}`} />
            <span className="text-xs text-muted-foreground tabular-nums">{goal.progress.completed}/{goal.progress.total} projetos</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Vincule projetos a esta meta para acompanhar o progresso.</span>
        )}
      </button>
      {editing && <GoalFormDialog open onOpenChange={setEditing} goal={goal} />}
    </>
  );
}

export function GoalsPage() {
  const goals = useGoals();
  const [creating, setCreating] = useState(false);
  const byHorizon = GOAL_HORIZON.map((h) => ({ h, list: (goals.data ?? []).filter((g) => g.horizon === h) })).filter((x) => x.list.length);
  return (
    <Page wide>
      <PageHeader
        title="Metas"
        description="Resultados que você quer alcançar. O progresso vem dos projetos vinculados."
        actions={<Button variant="brand" size="sm" onClick={() => setCreating(true)}><PlusIcon /> Nova meta</Button>}
      />
      {goals.isPending ? <Skeleton className="h-40" /> : !byHorizon.length ? (
        <EmptyState icon={TargetIcon} title="Nenhuma meta" description="Defina para onde você está indo; projetos são os passos." action={<Button size="sm" variant="outline" onClick={() => setCreating(true)}>Criar meta</Button>} />
      ) : (
        <div className="space-y-8">
          {byHorizon.map(({ h, list }) => (
            <section key={h}>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{GOAL_HORIZON_LABEL[h]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((g) => <GoalCard key={g.id} goal={g} />)}</div>
            </section>
          ))}
        </div>
      )}
      {creating && <GoalFormDialog open onOpenChange={setCreating} />}
    </Page>
  );
}
