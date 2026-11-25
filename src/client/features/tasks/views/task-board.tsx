import type { CreateTaskInput, Task } from "@shared/para";
import { KanbanBoard, type KanbanColumn } from "@/components/kanban-board";
import { TASK_STATUS_LABEL } from "@/features/para/labels";
import { useUpdateTask } from "@/features/para/queries";
import { QuickAddTask } from "../quick-add-task";
import { TaskCard } from "../task-row";

const COLUMNS: KanbanColumn[] = [
  { id: "todo", title: TASK_STATUS_LABEL.todo },
  { id: "in_progress", title: TASK_STATUS_LABEL.in_progress, accent: "bg-amber-500" },
  { id: "waiting", title: TASK_STATUS_LABEL.waiting, accent: "bg-sky-500" },
  { id: "done", title: TASK_STATUS_LABEL.done, accent: "bg-success" },
];

export function TaskBoard({ tasks, defaults = {} }: { tasks: Task[]; defaults?: Partial<CreateTaskInput> }) {
  const update = useUpdateTask();
  return (
    <KanbanBoard
      columns={COLUMNS}
      items={tasks.filter((t) => t.status !== "cancelled")}
      getId={(t) => t.id}
      getColumn={(t) => t.status}
      getPosition={(t) => t.position}
      getLabel={(t) => t.title}
      renderCard={(t) => <TaskCard task={t} />}
      onMove={(t, status, position) => update.mutate({ id: t.id, status: status as Task["status"], position })}
      renderColumnFooter={(status) => <QuickAddTask defaults={{ ...defaults, status: status as Task["status"] }} placeholder="Adicionar" className="px-2" />}
    />
  );
}
