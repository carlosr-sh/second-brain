import { ConstructionIcon } from "lucide-react";
import type { NavModule } from "@/app/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/layout/page";

/** Honest placeholder for modules scheduled for later phases. */
export function ModulePlaceholderPage({ module }: { module: NavModule }) {
  return (
    <Page>
      <PageHeader
        title={module.label}
        description={module.description}
        icon={
          <span className="mt-1 flex size-8 items-center justify-center rounded-lg bg-muted">
            <module.icon className="size-4 text-muted-foreground" />
          </span>
        }
        actions={<Badge variant="outline">Fase {module.phase}</Badge>}
      />
      <EmptyState
        icon={ConstructionIcon}
        title="Ainda não implementado"
        description={`Este módulo será entregue na Fase ${module.phase} do roadmap. A estrutura de dados dele já existe no banco.`}
      />
    </Page>
  );
}
