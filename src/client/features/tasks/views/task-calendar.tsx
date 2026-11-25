import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, addMonths, isoWeekday } from "@shared/dates";
import type { CreateTaskInput, Task } from "@shared/para";
import { Button } from "@/components/ui/button";
import { useUpdateTask } from "@/features/para/queries";
import { useToday } from "@/features/para/use-today";
import { cn } from "@/lib/utils";
import { useTaskEditor } from "../task-editor-context";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const monthTitle = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

/** 6×7 grid of dates covering `month` (YYYY-MM-01), Monday-first. */
export function monthGrid(month: string): string[] {
  const start = addDays(month, -isoWeekday(month));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function Chip({ task }: { task: Task }) {
  const { openTask } = useTaskEditor();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => openTask(task.id)}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-4 touch-manipulation",
        task.status === "done" ? "bg-muted text-muted-foreground line-through" : "bg-brand-soft text-foreground",
        isDragging && "z-10 opacity-70 shadow-lg",
      )}
      data-testid="calendar-chip"
      {...attributes}
      {...listeners}
    >
      {task.title}
    </button>
  );
}

function Day({ date, inMonth, today, tasks, onAdd }: { date: string; inMonth: boolean; today: string; tasks: Task[]; onAdd: (d: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00Z`));
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${label}, ${tasks.length} tarefa(s)`}
      className={cn("group flex min-h-24 flex-col gap-0.5 border-t border-l p-1 sm:min-h-28", !inMonth && "bg-muted/40", isOver && "bg-brand-soft/50")}
    >
      <div className="flex items-center justify-between">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", date === today ? "bg-brand font-semibold text-brand-foreground" : inMonth ? "" : "text-muted-foreground")}>
          {Number(date.slice(8))}
        </span>
        <button type="button" onClick={() => onAdd(date)} aria-label={`Nova tarefa em ${label}`} className="size-5 rounded text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100">+</button>
      </div>
      {tasks.slice(0, 4).map((t) => <Chip key={t.id} task={t} />)}
      {tasks.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">+{tasks.length - 4}</span>}
    </div>
  );
}

/** Month calendar by due date; drag a task to another day to reschedule. */
export function TaskCalendar({ tasks, defaults = {} }: { tasks: Task[]; defaults?: Partial<CreateTaskInput> }) {
  const today = useToday();
  const [month, setMonth] = useState(() => `${today.slice(0, 7)}-01`);
  const update = useUpdateTask();
  const { openNew } = useTaskEditor();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }));

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    return map;
  }, [tasks]);
  const undated = tasks.filter((t) => !t.dueDate && t.status !== "done").length;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const dueDate = String(over.id).replace("day:", "");
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.dueDate !== dueDate) update.mutate({ id: task.id, dueDate });
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold">{monthTitle.format(new Date(`${month}T00:00:00Z`)).replace(/^./, (c) => c.toUpperCase())}</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(`${today.slice(0, 7)}-01`)}>Hoje</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRightIcon /></Button>
        </div>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div role="grid" aria-label="Calendário de tarefas" className="overflow-hidden rounded-xl border-r border-b bg-card">
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="border-l px-2 py-1.5 text-xs font-medium text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid(month).map((date) => (
              <Day key={date} date={date} inMonth={date.slice(0, 7) === month.slice(0, 7)} today={today} tasks={byDay.get(date) ?? []} onAdd={(d) => openNew({ ...defaults, dueDate: d })} />
            ))}
          </div>
        </div>
      </DndContext>
      {undated > 0 && <p className="mt-2 text-xs text-muted-foreground">{undated} tarefa(s) aberta(s) sem vencimento não aparecem no calendário.</p>}
    </div>
  );
}
