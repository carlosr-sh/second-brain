import { LayersIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaFormDialog } from "@/features/forms/entity-forms";
import { useAreas } from "@/features/para/queries";
import { Page, PageHeader } from "@/layout/page";

export function AreasPage() {
  const areas = useAreas();
  const [creating, setCreating] = useState(false);
  return (
    <Page wide>
      <PageHeader
        title="Áreas"
        description="Responsabilidades contínuas, sem data para acabar: saúde, finanças, carreira, casa."
        actions={<Button variant="brand" size="sm" onClick={() => setCreating(true)}><PlusIcon /> Nova área</Button>}
      />
      {areas.isPending ? <Skeleton className="h-40" /> : !areas.data?.length ? (
        <EmptyState icon={LayersIcon} title="Nenhuma área" description="Áreas organizam projetos, metas e tarefas recorrentes por responsabilidade." action={<Button size="sm" variant="outline" onClick={() => setCreating(true)}>Criar área</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.data.map((a) => (
            <Link key={a.id} to={`/areas/${a.id}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-brand/50" data-testid="area-card">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><LayersIcon className="size-4" /></span>
                <h2 className="font-medium group-hover:underline">{a.name}</h2>
              </div>
              {a.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
              <p className="mt-3 text-xs text-muted-foreground">{a.stats.activeProjects} projeto(s) ativo(s) · {a.stats.openTasks} tarefa(s) aberta(s)</p>
            </Link>
          ))}
        </div>
      )}
      {creating && <AreaFormDialog open onOpenChange={setCreating} />}
    </Page>
  );
}
