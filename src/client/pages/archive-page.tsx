import { ArchiveIcon, ArchiveRestoreIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import type { TrashEntity } from "@shared/para";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreas, useEmptyTrash, useGoals, useProjects, usePurgeEntity, useRestoreEntity, useTasks, useTrash, useUpdateArea, useUpdateGoal, useUpdateProject, useUpdateTask } from "@/features/para/queries";
import { Page, PageHeader } from "@/layout/page";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const ENTITY_LABEL: Record<TrashEntity, string> = {
  area: "Área", goal: "Meta", project: "Projeto", task: "Tarefa", note: "Nota", notebook: "Caderno", resource: "Recurso", bookmark: "Link", book: "Livro",
};
const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Erro");

function Row({ entity, title, meta, children }: { entity: TrashEntity; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5" data-testid="archive-row">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{ENTITY_LABEL[entity]}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
      {meta && <span className="hidden text-xs text-muted-foreground sm:inline">{meta}</span>}
      {children}
    </li>
  );
}

function ArchivedList() {
  const areas = useAreas(true);
  const projects = useProjects({ archived: "true" });
  const goals = useGoals({ archived: "true" });
  const tasks = useTasks({ archived: "true" });
  const ua = useUpdateArea(), up = useUpdateProject(), ug = useUpdateGoal(), ut = useUpdateTask();
  if (areas.isPending || projects.isPending || goals.isPending || tasks.isPending) return <Skeleton className="h-40" />;

  // Tasks archived together with their project are restored with it: hide them here.
  const archivedProjectIds = new Set((projects.data ?? []).map((p) => p.id));
  const items = [
    ...(areas.data ?? []).map((a) => ({ entity: "area" as const, id: a.id, title: a.name, at: a.archivedAt!, restore: () => ua.mutate({ id: a.id, archived: false }, { onError }) })),
    ...(projects.data ?? []).map((p) => ({ entity: "project" as const, id: p.id, title: p.name, at: p.archivedAt!, restore: () => up.mutate({ id: p.id, archived: false }, { onError }) })),
    ...(goals.data ?? []).map((g) => ({ entity: "goal" as const, id: g.id, title: g.title, at: g.archivedAt!, restore: () => ug.mutate({ id: g.id, archived: false }, { onError }) })),
    ...(tasks.data ?? []).filter((t) => !t.parentTaskId && !(t.projectId && archivedProjectIds.has(t.projectId)))
      .map((t) => ({ entity: "task" as const, id: t.id, title: t.title, at: t.archivedAt!, restore: () => ut.mutate({ id: t.id, archived: false }, { onError }) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (!items.length) return <EmptyState icon={ArchiveIcon} title="Arquivo vazio" description="Projetos concluídos e áreas inativas vêm para cá, preservados e pesquisáveis." />;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((i) => (
        <Row key={`${i.entity}:${i.id}`} entity={i.entity} title={i.title} meta={`arquivado ${formatDateTime(i.at)}`}>
          <Button variant="ghost" size="sm" onClick={i.restore}><ArchiveRestoreIcon /> Desarquivar</Button>
        </Row>
      ))}
    </ul>
  );
}

function TrashList() {
  const trash = useTrash();
  const restore = useRestoreEntity();
  const purge = usePurgeEntity();
  const empty = useEmptyTrash();
  const [confirm, setConfirm] = useState<{ entity: TrashEntity; id: string; title: string } | "all" | null>(null);
  if (trash.isPending) return <Skeleton className="h-40" />;
  if (!trash.data?.length) return <EmptyState icon={Trash2Icon} title="Lixeira vazia" description="Itens excluídos ficam aqui até você restaurá-los ou excluí-los definitivamente." />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setConfirm("all")}><Trash2Icon /> Esvaziar lixeira</Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {trash.data.map((i) => (
          <Row key={`${i.entity}:${i.id}`} entity={i.entity} title={i.title} meta={`excluído ${formatDateTime(i.deletedAt)}`}>
            <Button variant="ghost" size="sm" onClick={() => restore.mutate({ entity: i.entity, id: i.id }, { onSuccess: () => toast("Restaurado"), onError })}><RotateCcwIcon /> Restaurar</Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Excluir "${i.title}" definitivamente`} onClick={() => setConfirm(i)}><Trash2Icon /></Button>
          </Row>
        ))}
      </ul>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "all" ? "Esvaziar a lixeira?" : "Excluir definitivamente?"}
        description={confirm === "all" ? "Todos os itens da lixeira serão apagados para sempre, incluindo tarefas de projetos excluídos." : `"${confirm?.title ?? ""}" será apagado para sempre. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir definitivamente"
        pending={purge.isPending || empty.isPending}
        onConfirm={() => {
          const done = { onSuccess: () => { setConfirm(null); toast("Excluído definitivamente"); }, onError };
          if (confirm === "all") empty.mutate(undefined, done);
          else if (confirm) purge.mutate({ entity: confirm.entity, id: confirm.id }, done);
        }}
      />
    </>
  );
}

export function ArchivePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "trash" ? "trash" : "archived";
  return (
    <Page>
      <PageHeader title="Arquivo" description="O “A” do PARA: o que saiu de foco continua preservado. A lixeira guarda o que foi excluído." />
      <Segmented className="mb-5" label="Seção" value={tab} onChange={(v) => setParams(v === "trash" ? { tab: v } : {}, { replace: true })}
        options={[{ value: "archived", label: "Arquivados", icon: <ArchiveIcon /> }, { value: "trash", label: "Lixeira", icon: <Trash2Icon /> }]} />
      {tab === "archived" ? <ArchivedList /> : <TrashList />}
    </Page>
  );
}
