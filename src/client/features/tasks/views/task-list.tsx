import type { ReactNode } from "react";
import type { Task } from "@shared/para";
import { TaskRow } from "../task-row";

export interface TaskGroup {
  key: string;
  title: ReactNode;
  tasks: Task[];
  tone?: "danger" | "brand";
}

/** Grouped list; subtasks are shown under the editor, not as top-level rows. */
export function TaskList({ groups, showLocation = true, empty }: { groups: TaskGroup[]; showLocation?: boolean; empty?: ReactNode }) {
  const visible = groups.filter((g) => g.tasks.length > 0);
  if (!visible.length) return <>{empty}</>;
  return (
    <div className="space-y-6">
      {visible.map((g) => (
        <section key={g.key} aria-label={typeof g.title === "string" ? g.title : undefined}>
          <h2 className={`mb-1 flex items-center gap-2 px-1 text-xs font-medium tracking-wide uppercase ${g.tone === "danger" ? "text-destructive" : g.tone === "brand" ? "text-brand" : "text-muted-foreground"}`}>
            {g.title} <span className="tabular-nums opacity-70">{g.tasks.length}</span>
          </h2>
          <ul className="divide-y rounded-xl border bg-card">{g.tasks.map((t) => <TaskRow key={t.id} task={t} showLocation={showLocation} />)}</ul>
        </section>
      ))}
    </div>
  );
}
