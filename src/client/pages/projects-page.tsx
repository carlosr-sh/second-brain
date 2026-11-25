import { FolderKanbanIcon, KanbanSquareIcon, ListIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Project } from "@shared/para";
import { EmptyState } from "@/components/empty-state";
import { KanbanBoard, type KanbanColumn } from "@/components/kanban-board";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectFormDialog } from "@/features/forms/entity-forms";
import { PROJECT_STATUS_LABEL } from "@/features/para/labels";
import { useProjects, useUpdateProject } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { ProjectCard } from "@/features/projects/project-card";
import { Page, PageHeader } from "@/layout/page";

const COLUMNS: KanbanColumn[] = [
  { id: "planned", title: PROJECT_STATUS_LABEL.planned },
  { id: "active", title: PROJECT_STATUS_LABEL.active, accent: "bg-brand" },
  { id: "on_hold", title: PROJECT_STATUS_LABEL.on_hold, accent: "bg-amber-500" },
  { id: "completed", title: PROJECT_STATUS_LABEL.completed, accent: "bg-success" },
];

export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "board";
  const [creating, setCreating] = useState(false);
  const projects = useProjects();
  const update = useUpdateProject();
  const { areaName } = useParaLookup();
  const items = (projects.data ?? []).filter((p) => p.status !== "cancelled");

  const byArea = new Map<string, Project[]>();
  for (const p of items) {
    const k = p.areaId ?? "";
    byArea.set(k, [...(byArea.get(k) ?? []), p]);
  }

  return (
    <Page wide>
      <PageHeader
        title="Projetos"
        description="Esforços com um resultado claro e um fim. Concluídos podem ir para o Arquivo."
        actions={<Button variant="brand" size="sm" onClick={() => setCreating(true)}><PlusIcon /> Novo projeto</Button>}
      />
      <Segmented
        className="mb-5"
        label="Visualização"
        value={view}
        onChange={(v) => setParams(v === "board" ? {} : { view: v }, { replace: true })}
        options={[{ value: "board", label: "Quadro", icon: <KanbanSquareIcon /> }, { value: "list", label: "Por área", icon: <ListIcon /> }]}
      />
      {projects.isPending ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState icon={FolderKanbanIcon} title="Nenhum projeto ainda" description="Um projeto tem objetivo e prazo: “Lançar o site”, “Planejar a viagem”." action={<Button size="sm" variant="outline" onClick={() => setCreating(true)}>Criar projeto</Button>} />
      ) : view === "board" ? (
        <KanbanBoard
          columns={COLUMNS}
          items={items}
          getId={(p) => p.id}
          getColumn={(p) => p.status}
          getPosition={(p) => p.position}
          getLabel={(p) => p.name}
          renderCard={(p) => <ProjectCard project={p} />}
          onMove={(p, status, position) => update.mutate({ id: p.id, status: status as Project["status"], position })}
        />
      ) : (
        <div className="space-y-6">
          {[...byArea.entries()].sort(([a], [b]) => (a ? (areaName.get(a) ?? "") : "~").localeCompare(b ? (areaName.get(b) ?? "") : "~")).map(([areaId, list]) => (
            <section key={areaId || "none"}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{areaId ? areaName.get(areaId) : "Sem área"}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
            </section>
          ))}
        </div>
      )}
      {creating && <ProjectFormDialog open onOpenChange={setCreating} />}
    </Page>
  );
}
