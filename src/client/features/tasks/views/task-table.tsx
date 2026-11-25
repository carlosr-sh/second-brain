import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Task } from "@shared/para";
import { describeRule } from "@shared/recurrence";
import { PRIORITY_LABEL, PRIORITY_RANK, TASK_STATUS_LABEL } from "@/features/para/labels";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTaskEditor } from "../task-editor-context";
import { TaskCheckbox } from "../task-row";

type SortKey = "title" | "status" | "priority" | "location" | "dueDate";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "dueDate", dir: 1 });
  const { projectName, areaName } = useParaLookup();
  const { openTask } = useTaskEditor();
  const today = useToday();
  const where = (t: Task) => (t.projectId ? projectName.get(t.projectId) : t.areaId ? areaName.get(t.areaId) : "") ?? "";

  const rows = useMemo(() => {
    const val = (t: Task): string | number => {
      switch (sort.key) {
        case "priority": return PRIORITY_RANK[t.priority];
        case "location": return where(t).toLowerCase();
        case "dueDate": return t.dueDate ?? "9999-12-31";
        case "status": return t.status;
        default: return t.title.toLowerCase();
      }
    };
    return [...tasks].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [tasks, sort, projectName, areaName]);

  const Th = ({ k, children, className }: { k: SortKey; children: string; className?: string }) => (
    <th aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 font-medium", className)}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2"><span className="sr-only">Concluída</span></th>
            <Th k="title">Tarefa</Th>
            <Th k="status">Status</Th>
            <Th k="priority">Prioridade</Th>
            <Th k="location">Onde</Th>
            <Th k="dueDate">Vencimento</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-accent/40" data-testid="task-table-row">
              <td className="px-3 py-2"><TaskCheckbox task={t} /></td>
              <td className="px-3 py-2">
                <button type="button" onClick={() => openTask(t.id)} className={cn("text-left hover:underline", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</button>
                {t.recurrenceRule && <span className="ml-2 text-xs text-muted-foreground">{describeRule(t.recurrenceRule)}</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{TASK_STATUS_LABEL[t.status]}</td>
              <td className="px-3 py-2 text-muted-foreground">{t.priority === "none" ? "—" : PRIORITY_LABEL[t.priority]}</td>
              <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">{where(t) || "—"}</td>
              <td className={cn("px-3 py-2 whitespace-nowrap", t.dueDate && t.dueDate < today && t.status !== "done" ? "text-destructive" : "text-muted-foreground")}>
                {t.dueDate ? formatDueDate(t.dueDate, today) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
