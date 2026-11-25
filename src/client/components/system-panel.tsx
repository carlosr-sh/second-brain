import { useCallback, useState } from "react";
import type { IntegrityCheckResponse, MeResponse, SystemStatusResponse } from "@shared/api";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { StatusBadge } from "./status-badge";

interface Snapshot {
  me: MeResponse;
  status: SystemStatusResponse;
}

export function SystemPanel() {
  const load = useCallback(
    async (): Promise<Snapshot> => ({
      me: await api<MeResponse>("/me"),
      status: await api<SystemStatusResponse>("/system/status"),
    }),
    [],
  );
  const [state, reload] = useAsync(load);
  const [integrity, setIntegrity] = useState<IntegrityCheckResponse | string | null>(null);

  const runIntegrityCheck = async () => {
    setIntegrity(null);
    try {
      setIntegrity(await api<IntegrityCheckResponse>("/system/integrity-check", { method: "POST", body: "{}" }));
    } catch (e) {
      setIntegrity(e instanceof Error ? e.message : String(e));
    }
  };

  if (state.status === "loading") return <p className="text-sm text-neutral-500">Carregando…</p>;
  if (state.status === "error")
    return (
      <div role="alert" className="rounded-lg border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
        {state.error.message}
      </div>
    );

  const { me, status } = state.data;
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="text-sm text-neutral-500">Autenticado como</p>
        <p className="font-medium" data-testid="me-email">{me.email}</p>
        <p className="text-xs text-neutral-500">
          via {me.authSource === "access" ? "Cloudflare Access" : "bypass local de desenvolvimento"} · {me.environment} · {me.timezone}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Infraestrutura</h2>
        <StatusBadge label="Banco de dados (D1)" ok={status.checks.database.ok} detail={`${status.checks.database.latencyMs} ms`} />
        <StatusBadge label="Armazenamento (R2)" ok={status.checks.storage.ok} detail={`${status.checks.storage.latencyMs} ms`} />
        <p className="text-xs text-neutral-500">
          v{status.version} · migrações: {status.migrations.length ? status.migrations.join(", ") : "nenhuma"} · servidor:{" "}
          {formatDateTime(status.serverTime)}
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runIntegrityCheck}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Verificar integridade do banco
        </button>
        <button type="button" onClick={reload} className="text-sm text-neutral-500 underline-offset-4 hover:underline">
          Atualizar
        </button>
        {integrity !== null && (
          <span className="text-sm" data-testid="integrity-result">
            {typeof integrity === "string"
              ? `Erro: ${integrity}`
              : integrity.ok
                ? "Integridade OK ✓"
                : `Problemas: quick_check=${integrity.quickCheck}, FKs=${integrity.foreignKeyViolations}`}
          </span>
        )}
      </section>
    </div>
  );
}
