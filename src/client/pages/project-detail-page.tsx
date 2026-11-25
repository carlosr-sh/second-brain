import { ArrowLeftIcon, KanbanSquareIcon, ListIcon, TargetIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { PROJECT_STATUS } from "@shared/enums";
import type { Project } from "@shared/para";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectFormDialog } from "@/features/forms/entity-forms";
import { EntityActions } from "@/features/para/entity-actions";
import { PROJECT_STATUS_LABEL } from "@/features/para/labels";
import { useGoals, useProject, useTasks, useUpdateProject } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { TaskBoard } from "@/features/tasks/views/task-board";
import { TaskList } from "@/features/tasks/views/task-list";
import { Page } from "@/layout/page";
import { ApiError } from "@/lib/api";
import { formatDueDate } from "@/lib/format";
import { NotFoundPage } from "./error-pages";

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const project = useProject(id);
  if (project.isPending) return <Page><Skeleton className="h-40" /></Page>;
  if (!project.data) return <NotFoundPage />;
  return <ProjectDetail project={project.data} />;
}

function ProjectDetail({ project }: { project: Project }) {
  const [view, setView] = useState<"list" | "board">("list");
  const [editing, setEditing] = useState(false);
  const tasks = useTasks({ projectId: project.id });
  const update = useUpdateProject();
  const goals = useGoals();
  const { areaName } = useParaLookup();
  const today = useToday();
  const topLevel = (tasks.data ?? []).filter((t) => !t.parentTaskId);
  const open = topLevel.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = topLevel.filter((t) => t.status === "done");
  const goal = goals.data?.find((g) => g.id === project.goalId);
  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Erro");

  return (
    <Page wide>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Projetos</Link>
      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{project.name}</h1>
            {project.archivedAt && <Badge variant="outline">Arquivado</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {project.areaId && <Link to={`/areas/${project.areaId}`} className="hover:text-foreground">Área: {areaName.get(project.areaId)}</Link>}
            {goal && <span className="inline-flex items-center gap-1"><TargetIcon className="size-3.5" />{goal.title}</span>}
            {project.dueDate && <span className={project.dueDate < today && project.status !== "completed" ? "text-destructive" : ""}>Prazo: {formatDueDate(project.dueDate, today)}</span>}
          </div>
          {project.description && <p className="mt-3 max-w-2xl text-sm whitespace-pre-wrap">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect aria-label="Status do projeto" value={project.status} onChange={(e) => update.mutate({ id: project.id, status: e.target.value as Project["status"] }, { onError })} className="w-36">
            {PROJECT_STATUS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
          </NativeSelect>
          <EntityActions
            entity="project" id={project.id} archived={!!project.archivedAt} backTo="/projects"
            onEdit={() => setEditing(true)}
            onArchiveToggle={() => update.mutate({ id: project.id, archived: !project.archivedAt }, { onSuccess: () => toast(project.archivedAt ? "Projeto desarquivado" : "Projeto e tarefas arquivados"), onError })}
          />
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Segmented label="Visualização" value={view} onChange={setView} options={[{ value: "list", label: "Lista", icon: <ListIcon /> }, { value: "board", label: "Quadro", icon: <KanbanSquareIcon /> }]} />
        {topLevel.length > 0 && (
          <div className="flex min-w-48 flex-1 items-center gap-2 sm:max-w-xs">
            <Progress value={done.length} max={open.length + done.length} label="Progresso do projeto" />
            <span className="text-xs text-muted-foreground tabular-nums">{done.length}/{open.length + done.length}</span>
          </div>
        )}
      </div>

      {tasks.isPending ? <Skeleton className="h-40" /> : view === "board" ? (
        <TaskBoard tasks={topLevel} defaults={{ projectId: project.id }} />
      ) : (
        <div className="space-y-4">
          <QuickAddTask defaults={{ projectId: project.id }} className="rounded-xl border bg-card" />
          <TaskList
            showLocation={false}
            groups={[{ key: "open", title: "Abertas", tasks: open }, { key: "done", title: "Concluídas", tasks: done }]}
            empty={<EmptyState icon={ListIcon} title="Sem tarefas" description="Quebre o projeto em próximas ações concretas." />}
          />
        </div>
      )}
      {editing && <ProjectFormDialog open onOpenChange={setEditing} project={project} />}
    </Page>
  );
}
