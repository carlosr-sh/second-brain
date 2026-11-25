import { CalendarDaysIcon, CalendarIcon, KanbanSquareIcon, ListIcon, PlusIcon, SunIcon, TableIcon } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { addDays } from "@shared/dates";
import type { Task } from "@shared/para";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { OPEN_TASK_STATUSES } from "@/features/para/labels";
import { useTasks } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { useTaskEditor } from "@/features/tasks/task-editor-context";
import { TaskBoard } from "@/features/tasks/views/task-board";
import { TaskCalendar } from "@/features/tasks/views/task-calendar";
import { TaskList, type TaskGroup } from "@/features/tasks/views/task-list";
import { TaskTable } from "@/features/tasks/views/task-table";
import { Page, PageHeader } from "@/layout/page";
import { formatDueDate } from "@/lib/format";

const VIEWS = [
  { value: "today", label: "Hoje", icon: <SunIcon /> },
  { value: "upcoming", label: "Próximos 7 dias", icon: <CalendarDaysIcon /> },
  { value: "list", label: "Lista", icon: <ListIcon /> },
  { value: "board", label: "Quadro", icon: <KanbanSquareIcon /> },
  { value: "calendar", label: "Calendário", icon: <CalendarIcon /> },
  { value: "table", label: "Tabela", icon: <TableIcon /> },
] as const;
type View = (typeof VIEWS)[number]["value"];

const OPEN = OPEN_TASK_STATUSES.join(",");

function Loading() {
  return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
}

function TodayView() {
  const today = useToday();
  const tasks = useTasks({ status: OPEN, dueTo: today });
  if (tasks.isPending) return <Loading />;
  const all = tasks.data ?? [];
  const groups: TaskGroup[] = [
    { key: "overdue", title: "Atrasadas", tasks: all.filter((t) => t.dueDate! < today), tone: "danger" },
    { key: "today", title: "Hoje", tasks: all.filter((t) => t.dueDate === today), tone: "brand" },
  ];
  return (
    <div className="space-y-4">
      <QuickAddTask defaults={{ dueDate: today }} placeholder="Adicionar tarefa para hoje…" className="rounded-xl border bg-card" />
      <TaskList groups={groups} empty={<EmptyState icon={SunIcon} title="Nada para hoje" description="Nenhuma tarefa vencendo hoje ou atrasada. Aproveite ou planeje os próximos dias." />} />
    </div>
  );
}

function UpcomingView() {
  const today = useToday();
  const tasks = useTasks({ status: OPEN, dueFrom: addDays(today, 1), dueTo: addDays(today, 7) });
  if (tasks.isPending) return <Loading />;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const groups: TaskGroup[] = days.map((d) => ({ key: d, title: formatDueDate(d, today), tasks: (tasks.data ?? []).filter((t) => t.dueDate === d) }));
  return <TaskList groups={groups} empty={<EmptyState icon={CalendarDaysIcon} title="Semana livre" description="Nenhuma tarefa com vencimento nos próximos 7 dias." />} />;
}

/** Location filter value: "" (all), "none", "project:<id>", "area:<id>". */
function useFilteredTasks(location: string, showDone: boolean) {
  const params: Record<string, string> = {};
  const [kind, id] = location.split(":");
  if (kind === "project" && id) params.projectId = id;
  if (kind === "area" && id) params.areaId = id;
  if (kind === "none") params.unassigned = "true";
  const tasks = useTasks(params);
  const data = useMemo(
    () => (tasks.data ?? []).filter((t) => !t.parentTaskId && t.status !== "cancelled" && (showDone || t.status !== "done")),
    [tasks.data, showDone],
  );
  return { isPending: tasks.isPending, data, params };
}

function ListView({ tasks }: { tasks: Task[] }) {
  const { projectName, areaName } = useParaLookup();
  const groups = useMemo(() => {
    const map = new Map<string, TaskGroup>();
    for (const t of tasks) {
      const key = t.projectId ? `p:${t.projectId}` : t.areaId ? `a:${t.areaId}` : "none";
      const title = t.projectId ? (projectName.get(t.projectId) ?? "Projeto") : t.areaId ? (areaName.get(t.areaId) ?? "Área") : "Sem projeto ou área";
      if (!map.has(key)) map.set(key, { key, title, tasks: [] });
      map.get(key)!.tasks.push(t);
    }
    return [...map.values()].sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : String(a.title).localeCompare(String(b.title))));
  }, [tasks, projectName, areaName]);
  return <TaskList groups={groups} showLocation={false} empty={<EmptyState icon={ListIcon} title="Nenhuma tarefa" description="Crie uma tarefa com o botão acima ou capture algo com C." />} />;
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.value === params.get("view")) ? params.get("view") : "today") as View;
  const location = params.get("where") ?? "";
  const showDone = params.get("done") === "1";
  const { openNew } = useTaskEditor();
  const { projects, areas } = useParaLookup();
  const filtered = useFilteredTasks(location, showDone || view === "board" || view === "calendar");
  const update = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const filterable = view === "list" || view === "board" || view === "calendar" || view === "table";

  const defaults = filtered.params.projectId ? { projectId: filtered.params.projectId } : filtered.params.areaId ? { areaId: filtered.params.areaId } : {};

  return (
    <Page wide>
      <PageHeader title="Tarefas" actions={<Button variant="brand" size="sm" onClick={() => openNew(defaults)}><PlusIcon /> Nova tarefa</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented label="Visualização" value={view} onChange={(v) => update("view", v === "today" ? "" : v)} options={[...VIEWS]} />
        {filterable && (
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect aria-label="Filtrar por local" value={location} onChange={(e) => update("where", e.target.value)} className="w-52">
              <option value="">Todos os locais</option>
              <option value="none">Sem projeto ou área</option>
              {projects.length > 0 && <optgroup label="Projetos">{projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}</optgroup>}
              {areas.length > 0 && <optgroup label="Áreas">{areas.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}</optgroup>}
            </NativeSelect>
            {(view === "list" || view === "table") && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showDone} onChange={(e) => update("done", e.target.checked ? "1" : "")} className="accent-[var(--brand)]" />
                Mostrar concluídas
              </label>
            )}
          </div>
        )}
      </div>

      {view === "today" && <TodayView />}
      {view === "upcoming" && <UpcomingView />}
      {filterable && filtered.isPending && <Loading />}
      {view === "list" && !filtered.isPending && (
        <div className="space-y-4">
          <QuickAddTask defaults={defaults} className="rounded-xl border bg-card" />
          <ListView tasks={filtered.data} />
        </div>
      )}
      {view === "board" && !filtered.isPending && <TaskBoard tasks={filtered.data} defaults={defaults} />}
      {view === "calendar" && !filtered.isPending && <TaskCalendar tasks={filtered.data} defaults={defaults} />}
      {view === "table" && !filtered.isPending && (filtered.data.length ? <TaskTable tasks={filtered.data} /> : <EmptyState icon={TableIcon} title="Nenhuma tarefa" />)}
    </Page>
  );
}
