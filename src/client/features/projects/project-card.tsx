import { CalendarIcon, LayersIcon } from "lucide-react";
import { Link } from "react-router";
import type { Project } from "@shared/para";
import { Progress } from "@/components/ui/progress";
import { useParaLookup } from "@/features/para/use-lookup";
import { useToday } from "@/features/para/use-today";
import { formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  const today = useToday();
  const { areaName } = useParaLookup();
  const total = project.taskStats.open + project.taskStats.done;
  const late = project.dueDate && project.dueDate < today && project.status !== "completed" && project.status !== "cancelled";
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3 shadow-xs" data-testid="project-card">
      <Link to={`/projects/${project.id}`} onPointerDown={(e) => e.stopPropagation()} className="text-sm font-medium break-words hover:underline">
        {project.name}
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {project.areaId && <span className="inline-flex items-center gap-1"><LayersIcon className="size-3" />{areaName.get(project.areaId)}</span>}
        {project.dueDate && <span className={cn("inline-flex items-center gap-1", late && "text-destructive")}><CalendarIcon className="size-3" />{formatDueDate(project.dueDate, today)}</span>}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2">
          <Progress value={project.taskStats.done} max={total} label={`Progresso de ${project.name}`} />
          <span className="text-xs text-muted-foreground tabular-nums">{project.taskStats.done}/{total}</span>
        </div>
      )}
    </div>
  );
}
