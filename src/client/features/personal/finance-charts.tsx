import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";

/** Recharts tooltip props with its own default generics (names are strings or numbers). */
type TipProps = TooltipContentProps<TooltipValueType, string | number>;
import { formatBRL } from "@shared/money";
import type { BalancePoint, CategoryTotal, MonthSummary } from "@shared/personal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Chart conventions (dataviz skill): validated categorical slots --viz-1/--viz-2,
 * bars ≤ 24px with 4px rounded data-end, 2px lines, hairline recessive grid,
 * text in text inks (never series colors), legend for ≥ 2 series, and a table
 * view (required: light-mode orange is < 3:1 against the surface).
 */
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
/** Axis ticks without the currency symbol (the unit lives in the chart title): no wrapping. */
const tickBRL = (cents: number) => compact.format(cents / 100);
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)).replace(".", "");
const dayLabel = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const axis = { stroke: "var(--viz-axis)", tick: { fill: "var(--viz-ink-2)", fontSize: 12 }, tickLine: false } as const;

function ChartFrame({ title, legend, table, children }: { title: string; legend?: ReactNode; table: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <Button variant="ghost" size="sm" className="text-xs" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Ver gráfico" : "Ver tabela"}
        </Button>
      </CardHeader>
      {legend && !asTable && <div className="flex gap-4 text-xs text-muted-foreground">{legend}</div>}
      <CardContent>{asTable ? <div className="max-h-72 overflow-y-auto">{table}</div> : children}</CardContent>
    </Card>
  );
}

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />{label}</span>
);

function TooltipBox({ title, rows }: { title: string; rows: { color?: string; label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} aria-hidden />}
          <span className="font-semibold tabular-nums">{r.value}</span>
          <span className="text-muted-foreground">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const SimpleTable = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <table className="w-full text-sm">
    <thead className="text-xs text-muted-foreground">
      <tr>{head.map((h, i) => <th key={h} className={`py-1 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
    </thead>
    <tbody className="divide-y">
      {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`py-1.5 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}
    </tbody>
  </table>
);

/** Income vs expense per month: grouped columns, 2 series, one axis. Net is in tooltip + table. */
export function IncomeExpenseChart({ data }: { data: MonthSummary[] }) {
  const Tip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as MonthSummary;
    return (
      <TooltipBox
        title={monthLabel(String(label))}
        rows={[
          { color: "var(--viz-1)", label: "receitas", value: formatBRL(row.incomeCents) },
          { color: "var(--viz-2)", label: "despesas", value: formatBRL(row.expenseCents) },
          { label: "saldo do mês", value: formatBRL(row.netCents) },
        ]}
      />
    );
  };
  return (
    <ChartFrame
      title="Receitas e despesas por mês (R$)"
      legend={<><Swatch color="var(--viz-1)" label="Receitas" /><Swatch color="var(--viz-2)" label="Despesas" /></>}
      table={<SimpleTable head={["Mês", "Receitas", "Despesas", "Saldo"]} rows={data.map((d) => [d.month, formatBRL(d.incomeCents), formatBRL(d.expenseCents), formatBRL(d.netCents)])} />}
    >
      <div className="h-64" data-testid="chart-income-expense">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
            <YAxis tickFormatter={tickBRL} width={52} axisLine={false} {...axis} />
            <Tooltip content={Tip} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
            <Bar dataKey="incomeCents" name="Receitas" fill="var(--viz-1)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expenseCents" name="Despesas" fill="var(--viz-2)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Expenses by top-level category: sorted horizontal bars, one series, value at the tip. */
export function CategoryBars({ data, month }: { data: CategoryTotal[]; month: string }) {
  const total = data.reduce((s, d) => s + d.totalCents, 0);
  const height = Math.max(120, data.length * 34 + 16);
  return (
    <ChartFrame
      title={`Despesas por categoria — ${monthLabel(month)}`}
      table={<SimpleTable head={["Categoria", "Total", "%"]} rows={data.map((d) => [d.name, formatBRL(d.totalCents), `${total ? Math.round((d.totalCents / total) * 100) : 0}%`])} />}
    >
      {data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa neste mês.</p> : (
        <div style={{ height }} data-testid="chart-categories">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 88, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} axisLine={false} {...axis} />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.5 }}
                content={({ active, payload }: TipProps) => {
                  const d = payload?.[0]?.payload as CategoryTotal | undefined;
                  return active && d ? <TooltipBox title={d.name} rows={[{ label: `${total ? Math.round((d.totalCents / total) * 100) : 0}% do mês`, value: formatBRL(d.totalCents) }]} /> : null;
                }}
              />
              <Bar dataKey="totalCents" fill="var(--viz-1)" maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="totalCents" position="right" formatter={(v) => formatBRL(Number(v))} style={{ fill: "var(--foreground)", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

/** Total balance over time: 2px line with crosshair + tooltip. */
export function BalanceLine({ data }: { data: BalancePoint[] }) {
  const step = Math.max(1, Math.floor(data.length / 6));
  return (
    <ChartFrame title="Evolução do saldo total (R$)" table={<SimpleTable head={["Data", "Saldo"]} rows={data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => [dayLabel(d.date), formatBRL(d.balanceCents)])} />}>
      <div className="h-56" data-testid="chart-balance">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="date" tickFormatter={dayLabel} interval={step} minTickGap={24} {...axis} />
            <YAxis tickFormatter={tickBRL} width={52} axisLine={false} domain={["auto", "auto"]} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
              content={({ active, payload }: TipProps) => {
                const d = payload?.[0]?.payload as BalancePoint | undefined;
                return active && d ? <TooltipBox title={dayLabel(d.date)} rows={[{ label: "saldo", value: formatBRL(d.balanceCents) }]} /> : null;
              }}
            />
            <Line type="monotone" dataKey="balanceCents" stroke="var(--viz-1)" strokeWidth={2} dot={false} strokeLinecap="round" strokeLinejoin="round"
              activeDot={{ r: 4, fill: "var(--viz-1)", stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
