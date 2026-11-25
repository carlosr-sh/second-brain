import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import type { Area } from "@shared/para";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaFormDialog, GoalFormDialog, ProjectFormDialog } from "@/features/forms/entity-forms";
import { EntityActions } from "@/features/para/entity-actions";
import { OPEN_TASK_STATUSES } from "@/features/para/labels";
import { useArea, useGoals, useProjects, useTasks, useUpdateArea } from "@/features/para/queries";
import { ProjectCard } from "@/features/projects/project-card";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { TaskList } from "@/features/tasks/views/task-list";
import { GoalCard } from "@/pages/goals-page";
import { Page } from "@/layout/page";
import { NotFoundPage } from "./error-pages";
import { toastError } from "@/lib/toast-error";

export function AreaDetailPage() {
  const { id = "" } = useParams();
  const area = useArea(id);
  if (area.isPending) return <Page><Skeleton className="h-40" /></Page>;
  if (!area.data) return <NotFoundPage />;
  return <AreaDetail area={area.data} />;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AreaDetail({ area }: { area: Area }) {
  const [dialog, setDialog] = useState<"edit" | "project" | "goal" | null>(null);
  const projects = useProjects({ areaId: area.id });
  const goals = useGoals({ areaId: area.id });
  const tasks = useTasks({ areaId: area.id, status: OPEN_TASK_STATUSES.join(",") });
  const update = useUpdateArea();
  const direct = (tasks.data ?? []).filter((t) => t.areaId === area.id && !t.parentTaskId);
  const activeProjects = (projects.data ?? []).filter((p) => p.status !== "completed" && p.status !== "cancelled");

  return (
    <Page wide>
      <Link to="/areas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Áreas</Link>
      <header className="mb-8 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{area.name}</h1>
            {area.archivedAt && <Badge variant="outline">Arquivada</Badge>}
          </div>
          {area.description && <p className="mt-2 max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">{area.description}</p>}
        </div>
        <EntityActions
          entity="area" id={area.id} archived={!!area.archivedAt} backTo="/areas" onEdit={() => setDialog("edit")}
          onArchiveToggle={() => update.mutate({ id: area.id, archived: !area.archivedAt }, { onSuccess: () => toast(area.archivedAt ? "Área desarquivada" : "Área arquivada"), onError: (e) => toastError(e, "Erro") })}
        />
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Section title="Projetos ativos" action={<Button variant="ghost" size="sm" onClick={() => setDialog("project")}><PlusIcon /> Projeto</Button>}>
            {activeProjects.length ? <div className="grid gap-3 sm:grid-cols-2">{activeProjects.map((p) => <ProjectCard key={p.id} project={p} />)}</div> : <p className="text-sm text-muted-foreground">Nenhum projeto ativo nesta área.</p>}
          </Section>
          <Section title="Tarefas da área (fora de projetos)">
            <QuickAddTask defaults={{ areaId: area.id }} className="rounded-xl border bg-card" />
            <TaskList groups={[{ key: "direct", title: "Abertas", tasks: direct }]} showLocation={false} />
          </Section>
        </div>
        <Section title="Metas" action={<Button variant="ghost" size="sm" onClick={() => setDialog("goal")}><PlusIcon /> Meta</Button>}>
          {goals.data?.length ? <div className="grid gap-3">{goals.data.map((g) => <GoalCard key={g.id} goal={g} />)}</div> : <p className="text-sm text-muted-foreground">Nenhuma meta.</p>}
        </Section>
      </div>
      {dialog === "edit" && <AreaFormDialog open onOpenChange={() => setDialog(null)} area={area} />}
      {dialog === "project" && <ProjectFormDialog open onOpenChange={() => setDialog(null)} defaults={{ areaId: area.id }} />}
      {dialog === "goal" && <GoalFormDialog open onOpenChange={() => setDialog(null)} defaults={{ areaId: area.id }} />}
    </Page>
  );
}
