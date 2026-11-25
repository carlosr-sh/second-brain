import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GLOBAL_SHORTCUTS } from "@/features/shortcuts/global-shortcuts";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { useAuditLogs, useIntegrityCheck, useMe, useSystemStatus } from "@/features/system/hooks";
import { useTheme } from "@/features/theme/theme-provider";
import { THEME_OPTIONS } from "@/layout/theme-menu";
import { Page, PageHeader } from "@/layout/page";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Section title="Aparência" description="Sincronizada entre seus dispositivos.">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 sm:max-w-sm">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            type="button"
            aria-checked={preference === o.value}
            onClick={() => setPreference(o.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              preference === o.value && "border-brand bg-brand-soft/50 font-medium",
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function SystemSection() {
  const status = useSystemStatus();
  const integrity = useIntegrityCheck();
  const rows = status.data
    ? [
        ["Banco de dados (D1)", status.data.checks.database],
        ["Armazenamento (R2)", status.data.checks.storage],
      ] as const
    : [];
  return (
    <Section title="Sistema" description="Saúde da infraestrutura e integridade dos dados.">
      {status.isPending ? (
        <Skeleton className="h-20" />
      ) : status.data ? (
        <div className="space-y-3">
          <ul className="divide-y rounded-lg border text-sm">
            {rows.map(([label, check]) => (
              <li key={label} className="flex items-center justify-between px-3 py-2">
                <span>{label}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {check.latencyMs} ms
                  <span className={cn("size-2 rounded-full", check.ok ? "bg-success" : "bg-destructive")} aria-label={check.ok ? "ok" : "falha"} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            v{status.data.version} · {status.data.environment} · migrações: {status.data.migrations.join(", ") || "nenhuma"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => integrity.mutate()} disabled={integrity.isPending}>
              <ShieldCheckIcon /> Verificar integridade do banco
            </Button>
            {integrity.data && (
              <span className="text-sm" data-testid="integrity-result">
                {integrity.data.ok ? "Integridade OK ✓" : `Problemas: quick_check=${integrity.data.quickCheck}, FKs=${integrity.data.foreignKeyViolations}`}
              </span>
            )}
            {integrity.isError && <span className="text-sm text-destructive">Falha ao verificar</span>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-destructive">Não foi possível obter o status.</p>
      )}
    </Section>
  );
}

function AuditSection() {
  const logs = useAuditLogs();
  return (
    <Section title="Auditoria" description="Operações sensíveis registradas (últimas 20).">
      {logs.isPending ? (
        <Skeleton className="h-24" />
      ) : logs.data?.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Quem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.data.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(l.occurredAt)}</td>
                  <td className="px-3 py-2"><code className="text-xs">{l.action}</code></td>
                  <td className="px-3 py-2 text-muted-foreground">{l.actorEmail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
      )}
    </Section>
  );
}

function AccountSection() {
  const me = useMe();
  return (
    <Section title="Conta" description="Acesso protegido pelo Cloudflare Access.">
      {me.data ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium" data-testid="me-email">{me.data.email}</span>
          <Badge variant="outline">{me.data.authSource === "access" ? "Cloudflare Access" : "bypass local (dev)"}</Badge>
          <Badge variant="outline">{me.data.timezone}</Badge>
          {me.data.authSource === "access" && (
            <Button variant="ghost" size="sm" asChild className="ml-auto">
              <a href="/cdn-cgi/access/logout"><LogOutIcon /> Sair</a>
            </Button>
          )}
        </div>
      ) : (
        <Skeleton className="h-6 w-64" />
      )}
    </Section>
  );
}

export function SettingsPage() {
  return (
    <Page>
      <PageHeader title="Configurações" />
      <AppearanceSection />
      <Section title="Atalhos" description="Pressione ? em qualquer tela para ver todos.">
        <ul className="divide-y rounded-lg border text-sm">
          {GLOBAL_SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between px-3 py-2">
              {s.label} <KeysHint keys={s.keys} />
            </li>
          ))}
        </ul>
      </Section>
      <AccountSection />
      <SystemSection />
      <AuditSection />
    </Page>
  );
}
