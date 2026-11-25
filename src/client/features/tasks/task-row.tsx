import { CalendarIcon, FlagIcon, FolderIcon, LayersIcon, RepeatIcon } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@shared/para";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIORITY_COLOR, PRIORITY_LABEL } from "@/features/para/labels";
import { useUpdateTask } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTaskEditor } from "./task-editor-context";

export function TaskCheckbox({ task }: { task: Task }) {
  const update = useUpdateTask();
  const done = task.status === "done";
  return (
    <Checkbox
      checked={done}
      aria-label={done ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { id: task.id, status: checked ? "done" : "todo" },
          { onError: () => toast.error("Não foi possível atualizar a tarefa") },
        )
      }
    />
  );
}

export function TaskMeta({ task, showLocation = true }: { task: Task; showLocation?: boolean }) {
  const today = useToday();
  const { projectName, areaName } = useParaLookup();
  const open = task.status !== "done" && task.status !== "cancelled";
  const overdue = open && task.dueDate !== null && task.dueDate < today;
  const location = task.projectId ? projectName.get(task.projectId) : task.areaId ? areaName.get(task.areaId) : null;
  const items = [
    task.dueDate && (
      <span key="due" className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive", task.dueDate === today && open && "text-brand")}>
        <CalendarIcon className="size-3" />
        {overdue ? `${formatDueDate(task.dueDate, today)} · atrasada` : formatDueDate(task.dueDate, today)}
      </span>
    ),
    task.recurrenceRule && <RepeatIcon key="rec" className="size-3" aria-label="Recorrente" />,
    task.priority !== "none" && (
      <span key="prio" className={cn("inline-flex items-center gap-1", PRIORITY_COLOR[task.priority])}>
        <FlagIcon className="size-3" /> {PRIORITY_LABEL[task.priority]}
      </span>
    ),
    showLocation && location && (
      <span key="loc" className="inline-flex max-w-40 items-center gap-1 truncate">
        {task.projectId ? <FolderIcon className="size-3 shrink-0" /> : <LayersIcon className="size-3 shrink-0" />}
        <span className="truncate">{location}</span>
      </span>
    ),
  ].filter(Boolean);
  if (!items.length) return null;
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{items}</div>;
}

export function TaskRow({ task, showLocation, subtaskCount }: { task: Task; showLocation?: boolean; subtaskCount?: number }) {
  const { openTask } = useTaskEditor();
  const done = task.status === "done";
  return (
    <li className="group flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50" data-testid="task-row">
      <div className="pt-0.5">
        <TaskCheckbox task={task} />
      </div>
      <button type="button" onClick={() => openTask(task.id)} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
        <span className={cn("block text-sm break-words", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {task.title}
          {subtaskCount ? <span className="ml-2 text-xs text-muted-foreground">· {subtaskCount} subtarefa(s)</span> : null}
        </span>
        <TaskMeta task={task} showLocation={showLocation} />
      </button>
    </li>
  );
}

/** Card variant used by the kanban board. */
export function TaskCard({ task }: { task: Task }) {
  const { openTask } = useTaskEditor();
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3 shadow-xs" data-testid="task-card">
      <div className="pt-0.5">
        <TaskCheckbox task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openTask(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("block text-left text-sm break-words outline-none hover:underline", task.status === "done" && "text-muted-foreground line-through")}
        >
          {task.title}
        </button>
        <TaskMeta task={task} />
      </div>
    </div>
  );
}
