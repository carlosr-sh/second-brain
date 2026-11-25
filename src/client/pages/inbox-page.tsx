import { InboxIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import type { InboxStatusFilter } from "@shared/inbox";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUiState } from "@/app/ui-state";
import { useInboxItems } from "@/features/inbox/hooks";
import { InboxList } from "@/features/inbox/inbox-list";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { Page, PageHeader } from "@/layout/page";
import { cn } from "@/lib/utils";

const FILTERS: { value: InboxStatusFilter; label: string }[] = [
  { value: "open", label: "Abertos" },
  { value: "processed", label: "Processados" },
  { value: "all", label: "Todos" },
];

export function InboxPage() {
  const [status, setStatus] = useState<InboxStatusFilter>("open");
  const items = useInboxItems(status);
  const { setCaptureOpen } = useUiState();

  return (
    <Page>
      <PageHeader
        title="Inbox"
        description="Tudo o que você capturou e ainda não organizou. Na Fase 3, cada item poderá virar tarefa, nota ou projeto."
        actions={
          <Button variant="brand" size="sm" onClick={() => setCaptureOpen(true)}>
            <PlusIcon /> Capturar
          </Button>
        }
      />
      <div role="tablist" aria-label="Filtrar" className="mb-4 inline-flex rounded-lg bg-muted p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            type="button"
            aria-selected={status === f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors",
              status === f.value && "bg-background font-medium text-foreground shadow-xs",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.isError ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível carregar a Inbox.</p>
      ) : items.data.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={status === "open" ? "Inbox zerada" : "Nada por aqui"}
          description={
            <>
              Pressione <KeysHint keys="c" /> em qualquer lugar para capturar uma ideia.
            </>
          }
        />
      ) : (
        <InboxList items={items.data} />
      )}
    </Page>
  );
}
