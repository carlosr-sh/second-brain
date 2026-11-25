import { ArchiveIcon, ArrowLeftRightIcon, ChevronLeftIcon, ChevronRightIcon, LandmarkIcon, PaperclipIcon, PencilIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { addDays, addMonths } from "@shared/dates";
import { ACCOUNT_TYPE } from "@shared/enums";
import { formatBRL, parseBRL } from "@shared/money";
import type { Account, Transaction } from "@shared/personal";
import { isoDateIn } from "@shared/time";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestoreEntity, useTrashEntity } from "@/features/para/queries";
import { BalanceLine, CategoryBars, IncomeExpenseChart } from "@/features/personal/finance-charts";
import { CategoryOptions, MoneyInput, TransactionDialog, TransferDialog } from "@/features/personal/finance-dialogs";
import {
  useAccounts, useBalanceSeries, useByCategory, useCategories, useCreateAccount, useCreateCategory, useMonthlySummary, useSeedCategories,
  useTransaction, useTransactions, useUpdateAccount, useUpdateCategory,
} from "@/features/personal/queries";
import { Page, PageHeader } from "@/layout/page";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast-error";

const onError = (e: unknown) => toastError(e, "Erro");
const TYPE_LABEL: Record<Account["type"], string> = { checking: "Conta-corrente", savings: "Poupança", credit_card: "Cartão de crédito", cash: "Dinheiro", investment: "Investimentos", other: "Outra" };
const monthTitle = (m: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)).replace(/^./, (c) => c.toUpperCase());
const dayTitle = (d: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function Amount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", cents > 0 && "text-success", className)}>
      {cents > 0 ? "+" : ""}{formatBRL(cents)}
    </span>
  );
}

/** Stat tile: label · value (proportional figures, per the dataviz skill). */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight" data-testid={`stat-${label}`}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
}

/* ---------------- Overview ---------------- */
function Overview() {
  const today = isoDateIn(new Date());
  const month = today.slice(0, 7);
  const accounts = useAccounts();
  const summary = useMonthlySummary(12);
  const byCategory = useByCategory(month);
  const balance = useBalanceSeries(addDays(today, -89), today);
  const total = (accounts.data ?? []).reduce((s, a) => s + a.balanceCents, 0);
  const current = summary.data?.at(-1);
  if (accounts.isPending) return <Skeleton className="h-64" />;
  if (!accounts.data?.length) return <EmptyState icon={WalletIcon} title="Comece criando uma conta" description="Conta-corrente, cartão, carteira… Depois é só lançar receitas e despesas." />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo total" value={formatBRL(total)} hint={`${accounts.data.length} conta(s)`} />
        <Stat label="Receitas do mês" value={formatBRL(current?.incomeCents ?? 0)} />
        <Stat label="Despesas do mês" value={formatBRL(current?.expenseCents ?? 0)} />
        <Stat label="Resultado do mês" value={formatBRL(current?.netCents ?? 0)} hint={(current?.netCents ?? 0) >= 0 ? "sobrou" : "faltou"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {summary.data && <IncomeExpenseChart data={summary.data} />}
        {byCategory.data && <CategoryBars data={byCategory.data} month={month} />}
      </div>
      {balance.data && <BalanceLine data={balance.data} />}
    </div>
  );
}

/* ---------------- Transactions ---------------- */
function Transactions() {
  const [params, setParams] = useSearchParams();
  const highlight = params.get("tx");
  const focused = useTransaction(highlight);
  const [month, setMonth] = useState(params.get("month") ?? isoDateIn(new Date()).slice(0, 7));
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dialog, setDialog] = useState<"new" | "transfer" | Transaction | null>(params.get("new") ? "new" : null);
  const accounts = useAccounts();
  const categories = useCategories();
  const tx = useTransactions({ month, accountId, categoryId });
  const trash = useTrashEntity();
  const restore = useRestoreEntity();
  const accountName = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.name])), [accounts.data]);
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);

  // Opening a search result: jump to its month.
  useEffect(() => {
    if (focused.data && focused.data.date.slice(0, 7) !== month) setMonth(focused.data.date.slice(0, 7));
  }, [focused.data]);

  const list = tx.data ?? [];
  const totals = list.reduce((acc, t) => (t.kind === "income" ? { ...acc, in: acc.in + t.amountCents } : t.kind === "expense" ? { ...acc, out: acc.out - t.amountCents } : acc), { in: 0, out: 0 });
  const byDay = new Map<string, Transaction[]>();
  list.forEach((t) => byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]));

  const remove = (t: Transaction) =>
    trash.mutate({ entity: "transaction", id: t.id }, {
      onSuccess: () => toast("Lançamento movido para a lixeira", { action: { label: "Desfazer", onClick: () => restore.mutate({ entity: "transaction", id: t.id }) } }),
      onError,
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}><ChevronLeftIcon /></Button>
        <h2 className="min-w-40 text-center font-semibold" data-testid="tx-month">{monthTitle(month)}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}><ChevronRightIcon /></Button>
        <NativeSelect aria-label="Conta" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-44">
          <option value="">Todas as contas</option>
          {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-44">
          <option value="">Todas as categorias</option>
          <optgroup label="Despesas"><CategoryOptions categories={categories.data ?? []} kind="expense" /></optgroup>
          <optgroup label="Receitas"><CategoryOptions categories={categories.data ?? []} kind="income" /></optgroup>
        </NativeSelect>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog("transfer")} disabled={(accounts.data?.length ?? 0) < 2}><ArrowLeftRightIcon /> Transferir</Button>
          <Button variant="brand" size="sm" onClick={() => setDialog("new")} disabled={!accounts.data?.length}><PlusIcon /> Lançamento</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>Receitas <Amount cents={totals.in} className="font-medium" /></span>
        <span>Despesas <span className="font-medium text-foreground tabular-nums">{formatBRL(-totals.out)}</span></span>
        <span>Resultado <span className="font-medium text-foreground tabular-nums">{formatBRL(totals.in - totals.out)}</span></span>
      </div>
      {tx.isPending ? <Skeleton className="h-40" /> : !list.length ? <EmptyState icon={LandmarkIcon} title="Nenhum lançamento neste mês" /> : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground capitalize">{dayTitle(day)}</h3>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((t) => (
                  <li key={t.id} className={cn("group flex items-center gap-3 px-4 py-2.5", t.id === highlight && "bg-brand-soft/50")} data-testid="tx-row">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{t.description}{t.status === "pending" && <span className="ml-2 text-xs text-muted-foreground">(pendente)</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.kind === "transfer"
                          ? `${t.amountCents < 0 ? "Saída de" : "Entrada em"} ${accountName.get(t.accountId)} · ${t.amountCents < 0 ? "para" : "de"} ${accountName.get(t.counterpartAccountId ?? "") ?? "?"}`
                          : `${accountName.get(t.accountId) ?? ""}${t.categoryId ? ` · ${categoryName.get(t.categoryId) ?? ""}` : ""}`}
                      </span>
                    </div>
                    {t.receiptFileId && <a href={`/api/files/${t.receiptFileId}`} target="_blank" rel="noopener noreferrer" aria-label="Comprovante"><PaperclipIcon className="size-4 text-muted-foreground" /></a>}
                    <Amount cents={t.amountCents} className="text-sm font-medium" />
                    <div className="flex opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${t.description}`} onClick={() => setDialog(t)}><PencilIcon /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${t.description}`} onClick={() => remove(t)}><Trash2Icon /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {(dialog === "new" || (dialog && typeof dialog === "object")) && (
        <TransactionDialog open onOpenChange={(o) => { if (!o) { setDialog(null); if (params.get("new")) setParams((p) => { p.delete("new"); return p; }, { replace: true }); } }} transaction={typeof dialog === "object" ? dialog : undefined} defaultAccountId={accountId || undefined} />
      )}
      {dialog === "transfer" && <TransferDialog open onOpenChange={(o) => !o && setDialog(null)} />}
    </div>
  );
}

/* ---------------- Accounts ---------------- */
function Accounts() {
  const accounts = useAccounts();
  const archived = useAccounts(true);
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("checking");
  const [opening, setOpening] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const raw = opening.trim();
    const negative = raw.startsWith("-");
    const cents = raw ? parseBRL(raw.replace(/^-/, "")) : 0;
    if (cents === null) return toast.error("Saldo inicial inválido");
    create.mutate({ name: name.trim(), type, openingBalanceCents: negative ? -cents : cents }, { onSuccess: () => { setName(""); setOpening(""); }, onError });
  };
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[2fr_1.4fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da conta" aria-label="Nome da conta" maxLength={200} />
        <NativeSelect aria-label="Tipo de conta" value={type} onChange={(e) => setType(e.target.value as Account["type"])}>{ACCOUNT_TYPE.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</NativeSelect>
        <MoneyInput id="opening" value={opening} onChange={setOpening} />
        <Button type="submit" variant="brand" disabled={!name.trim() || create.isPending}><PlusIcon /> Criar</Button>
      </form>
      <p className="-mt-4 text-xs text-muted-foreground">Saldo inicial: o valor na data em que você começou a usar o app. Para cartão com fatura em aberto, use um valor negativo (ex.: -450,00).</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(accounts.data ?? []).map((a) => (
          <Card key={a.id} className="gap-2 p-4" data-testid="account-card">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.name}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Arquivar ${a.name}`} onClick={() => update.mutate({ id: a.id, archived: true }, { onError })}><ArchiveIcon /></Button>
            </div>
            <span className="text-xs text-muted-foreground">{TYPE_LABEL[a.type]} · {a.transactionCount} lançamento(s)</span>
            <span className={cn("text-xl font-semibold", a.balanceCents < 0 && "text-destructive")} data-testid="account-balance">{formatBRL(a.balanceCents)}</span>
            {a.clearedBalanceCents !== a.balanceCents && <span className="text-xs text-muted-foreground">Efetivado: {formatBRL(a.clearedBalanceCents)}</span>}
          </Card>
        ))}
      </div>
      {!!archived.data?.length && (
        <section>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Arquivadas</h3>
          <ul className="divide-y rounded-xl border bg-card">
            {archived.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{a.name} <span className="text-muted-foreground">· {formatBRL(a.balanceCents)}</span></span>
                <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: a.id, archived: false }, { onError })}>Desarquivar</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------- Categories ---------------- */
function Categories() {
  const categories = useCategories();
  const seed = useSeedCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const trash = useTrashEntity();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [parentId, setParentId] = useState("");
  const all = categories.data ?? [];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate({ name: name.trim(), kind, parentId: parentId || null }, { onSuccess: () => setName(""), onError });
  };
  if (categories.isPending) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-6">
      {!all.length && (
        <EmptyState icon={LandmarkIcon} title="Nenhuma categoria" description="Comece com um conjunto pronto (moradia, alimentação, salário…) e ajuste depois."
          action={<Button variant="brand" size="sm" onClick={() => seed.mutate(undefined, { onSuccess: (r) => toast.success(`${r.created} categorias criadas`), onError })}>Criar categorias padrão</Button>} />
      )}
      <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" aria-label="Nova categoria" maxLength={200} />
        <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setParentId(""); }} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]} />
        <NativeSelect aria-label="Dentro de" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Categoria principal</option>
          {all.filter((c) => c.kind === kind && !c.parentId).map((c) => <option key={c.id} value={c.id}>dentro de {c.name}</option>)}
        </NativeSelect>
        <Button type="submit" variant="brand" disabled={!name.trim()}><PlusIcon /> Criar</Button>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((k) => (
          <section key={k}>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{k === "expense" ? "Despesas" : "Receitas"}</h3>
            <ul className="divide-y rounded-xl border bg-card">
              {all.filter((c) => c.kind === k && !c.parentId).map((p) => (
                <li key={p.id} className="px-4 py-2">
                  <CategoryRow name={p.name} onArchive={() => update.mutate({ id: p.id, archived: true }, { onError })} onDelete={() => trash.mutate({ entity: "category", id: p.id }, { onError })} />
                  {all.filter((c) => c.parentId === p.id).map((c) => (
                    <div key={c.id} className="pl-5"><CategoryRow name={c.name} onArchive={() => update.mutate({ id: c.id, archived: true }, { onError })} onDelete={() => trash.mutate({ entity: "category", id: c.id }, { onError })} /></div>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ name, onArchive, onDelete }: { name: string; onArchive: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 py-0.5 text-sm">
      <span className="flex-1">{name}</span>
      <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" aria-label={`Arquivar ${name}`} onClick={onArchive}><ArchiveIcon /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${name}`} onClick={onDelete}><Trash2Icon /></Button>
      </div>
    </div>
  );
}

const TABS = [
  { value: "overview", label: "Visão geral" },
  { value: "transactions", label: "Lançamentos" },
  { value: "accounts", label: "Contas" },
  { value: "categories", label: "Categorias" },
] as const;

export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview") as (typeof TABS)[number]["value"];
  return (
    <Page wide>
      <PageHeader title="Finanças" description="Contas, lançamentos e para onde o dinheiro vai. Valores em reais, guardados em centavos exatos." />
      <Segmented className="mb-5" label="Seção" value={tab} onChange={(v) => setParams(v === "overview" ? {} : { tab: v }, { replace: true })} options={[...TABS]} />
      {tab === "overview" && <Overview />}
      {tab === "transactions" && <Transactions />}
      {tab === "accounts" && <Accounts />}
      {tab === "categories" && <Categories />}
    </Page>
  );
}

