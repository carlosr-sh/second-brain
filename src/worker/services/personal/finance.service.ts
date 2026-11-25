import { addDays, addMonths } from "../../../shared/dates";
import type {
  Account, BalancePoint, Category, CategoryTotal, CreateTransactionInput, CreateTransferInput, MonthSummary, Transaction, UpdateTransactionInput,
} from "../../../shared/personal";
import { uuidv7 } from "../../../shared/uuid";
import { assertLive, badRequest, conflict, notFound } from "../../lib/errors";
import type { FileRepository } from "../../repositories/knowledge/library.repository";
import type { ContactRepository } from "../../repositories/personal/contact.repository";
import type { AccountRepository, CategoryRepository, CategoryRow, TransactionRepository, TransactionRow } from "../../repositories/personal/finance.repository";
import { iso, isoRequired } from "../../repositories/_shared";

const archiveValue = (current: { archivedAt: Date | null }, archived: boolean | undefined) =>
  archived === undefined ? {} : { archivedAt: archived ? (current.archivedAt ?? new Date()) : null };

/* ---------------- accounts ---------------- */
export class AccountService {
  constructor(private readonly repo: AccountRepository) {}

  async list(archived: boolean): Promise<Account[]> {
    return (await this.repo.list(archived)).map((r) => ({
      id: r.account.id, name: r.account.name, type: r.account.type, currency: "BRL", institution: r.account.institution,
      openingBalanceCents: r.account.openingBalanceCents, balanceCents: r.balance, clearedBalanceCents: r.cleared,
      transactionCount: r.txCount, archivedAt: iso(r.account.archivedAt),
    }));
  }
  private async one(id: string) {
    const a = [...(await this.list(false)), ...(await this.list(true))].find((x) => x.id === id);
    if (!a) throw notFound("Conta não encontrada");
    return a;
  }
  async create(input: { name: string; type?: Account["type"]; openingBalanceCents?: number; institution?: string | null }) {
    return this.one((await this.repo.insert({ ...input, currency: "BRL" })).id);
  }
  async update(id: string, input: { name?: string; type?: Account["type"]; openingBalanceCents?: number; institution?: string | null; archived?: boolean }) {
    const current = assertLive(await this.repo.findById(id), "Conta");
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.one(id);
  }
  /** Accounts with transactions are archived, not deleted: deleting would orphan transfers in other accounts. */
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Conta");
    if ((await this.repo.liveTransactionCount(id)) > 0) throw conflict("A conta tem lançamentos: arquive-a em vez de excluir");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Conta não encontrada");
    if (!row.deletedAt) throw conflict("A conta não está na lixeira");
    await this.repo.update(id, { deletedAt: null });
    return this.one(id);
  }
}

/* ---------------- categories ---------------- */
const DEFAULT_CATEGORIES: { kind: "income" | "expense"; name: string; children?: string[] }[] = [
  { kind: "expense", name: "Moradia", children: ["Aluguel", "Contas da casa", "Manutenção"] },
  { kind: "expense", name: "Alimentação", children: ["Mercado", "Restaurantes", "Delivery"] },
  { kind: "expense", name: "Transporte", children: ["Combustível", "Transporte público", "Aplicativos"] },
  { kind: "expense", name: "Saúde", children: ["Plano de saúde", "Farmácia", "Consultas"] },
  { kind: "expense", name: "Educação" },
  { kind: "expense", name: "Lazer" },
  { kind: "expense", name: "Assinaturas" },
  { kind: "expense", name: "Impostos e taxas" },
  { kind: "expense", name: "Outros" },
  { kind: "income", name: "Salário" },
  { kind: "income", name: "Freelance" },
  { kind: "income", name: "Investimentos" },
  { kind: "income", name: "Reembolsos" },
  { kind: "income", name: "Outras receitas" },
];

export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  async list(includeArchived = false): Promise<Category[]> {
    return (await this.repo.list(includeArchived)).map(toCategoryDto);
  }
  async create(input: { name: string; kind: "income" | "expense"; parentId?: string | null; color?: string | null }): Promise<Category> {
    if (input.parentId) {
      const parent = assertLive(await this.repo.findById(input.parentId), "Categoria-pai");
      if (parent.parentId) throw conflict("Categorias têm no máximo dois níveis");
      if (parent.kind !== input.kind) throw conflict("A subcategoria deve ser do mesmo tipo da categoria-pai");
    }
    return toCategoryDto(await this.repo.insert(input));
  }
  async update(id: string, input: { name?: string; color?: string | null; archived?: boolean }): Promise<Category> {
    const current = assertLive(await this.repo.findById(id), "Categoria");
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return toCategoryDto((await this.repo.findById(id)) as CategoryRow);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Categoria");
    const usage = await this.repo.usage(id);
    if (usage.children) throw conflict("A categoria tem subcategorias: exclua-as ou arquive a categoria");
    if (usage.transactions) throw conflict("A categoria é usada em lançamentos: arquive-a em vez de excluir");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Categoria não encontrada");
    if (!row.deletedAt) throw conflict("A categoria não está na lixeira");
    await this.repo.update(id, { deletedAt: null });
    return toCategoryDto({ ...row, deletedAt: null });
  }
  /** Idempotent: creates only what is missing (case-insensitive by kind + parent). */
  async seedDefaults(): Promise<{ created: number }> {
    const existing = await this.repo.list(true);
    const key = (kind: string, parentId: string | null, name: string) => `${kind}|${parentId ?? ""}|${name.toLowerCase()}`;
    const index = new Map(existing.map((c) => [key(c.kind, c.parentId, c.name), c]));
    let created = 0;
    for (const def of DEFAULT_CATEGORIES) {
      let parent = index.get(key(def.kind, null, def.name));
      if (!parent) {
        parent = await this.repo.insert({ name: def.name, kind: def.kind });
        index.set(key(def.kind, null, def.name), parent);
        created++;
      }
      for (const child of def.children ?? []) {
        if (index.has(key(def.kind, parent.id, child))) continue;
        index.set(key(def.kind, parent.id, child), await this.repo.insert({ name: child, kind: def.kind, parentId: parent.id }));
        created++;
      }
    }
    return { created };
  }
}

function toCategoryDto(r: CategoryRow): Category {
  return { id: r.id, name: r.name, kind: r.kind, parentId: r.parentId, color: r.color, archivedAt: iso(r.archivedAt) };
}

/* ---------------- transactions ---------------- */
export class TransactionService {
  constructor(
    private readonly repo: TransactionRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository,
    private readonly contacts: ContactRepository,
    private readonly files: FileRepository,
  ) {}

  async list(q: { month?: string; accountId?: string; categoryId?: string; kind?: string }): Promise<Transaction[]> {
    const from = q.month ? `${q.month}-01` : undefined;
    const to = q.month ? addMonths(`${q.month}-01`, 1) : undefined;
    return (await this.repo.list({ from, to, accountId: q.accountId, categoryId: q.categoryId, kind: q.kind })).map((r) => toTxDto(r.tx, r.counterpart));
  }

  async get(id: string): Promise<Transaction> {
    const tx = assertLive(await this.repo.findById(id), "Lançamento");
    const counterpart = tx.transferGroupId ? ((await this.repo.findGroup(tx.transferGroupId)).find((t) => t.id !== id)?.accountId ?? null) : null;
    return toTxDto(tx, counterpart);
  }

  private async openAccount(id: string) {
    const a = assertLive(await this.accounts.findById(id), "Conta");
    if (a.archivedAt) throw conflict("Conta arquivada: desarquive para lançar");
    return a;
  }

  private async checkRefs(kind: "income" | "expense" | undefined, input: { categoryId?: string | null; contactId?: string | null; receiptFileId?: string | null }) {
    if (input.categoryId) {
      const c = assertLive(await this.categories.findById(input.categoryId), "Categoria");
      if (kind && c.kind !== kind) throw badRequest(kind === "expense" ? "Use uma categoria de despesa" : "Use uma categoria de receita");
    }
    if (input.contactId) assertLive(await this.contacts.findById(input.contactId), "Contato");
    if (input.receiptFileId) assertLive(await this.files.findById(input.receiptFileId), "Arquivo");
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    await this.openAccount(input.accountId);
    await this.checkRefs(input.kind, input);
    const { amountCents, ...rest } = input;
    const row = await this.repo.insert({ ...rest, amountCents: input.kind === "expense" ? -amountCents : amountCents });
    return this.get(row.id);
  }

  async transfer(input: CreateTransferInput): Promise<Transaction[]> {
    const [from, to] = [await this.openAccount(input.fromAccountId), await this.openAccount(input.toAccountId)];
    const group = uuidv7();
    const description = input.description?.trim() || `Transferência ${from.name} → ${to.name}`;
    const base = { kind: "transfer" as const, date: input.date, description, notes: input.notes ?? null, transferGroupId: group };
    const [a, b] = await this.repo.insertTransfer(
      { ...base, accountId: from.id, amountCents: -input.amountCents },
      { ...base, accountId: to.id, amountCents: input.amountCents },
    );
    return [toTxDto(a, b.accountId), toTxDto(b, a.accountId)];
  }

  async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const current = assertLive(await this.repo.findById(id), "Lançamento");
    if (current.transferGroupId) {
      const forbidden = (["accountId", "kind", "categoryId", "contactId"] as const).filter((k) => input[k] !== undefined);
      if (forbidden.length) throw badRequest("Em transferências, altere apenas valor, data, descrição, notas ou status");
      const legs = await this.repo.findGroup(current.transferGroupId);
      await this.repo.updateLegs(
        legs.map((leg) => ({
          id: leg.id,
          values: {
            ...(input.amountCents !== undefined ? { amountCents: Math.sign(leg.amountCents) * input.amountCents } : {}),
            ...(input.date !== undefined ? { date: input.date } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
          },
        })),
      );
      return this.get(id);
    }
    const kind = (input.kind ?? current.kind) as "income" | "expense";
    if (input.accountId) await this.openAccount(input.accountId);
    // Category must still match the (possibly new) kind.
    await this.checkRefs(kind, { ...input, categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId });
    const magnitude = input.amountCents ?? Math.abs(current.amountCents);
    const { amountCents: _a, ...rest } = input;
    await this.repo.update(id, { ...rest, kind, amountCents: kind === "expense" ? -magnitude : magnitude });
    return this.get(id);
  }

  /** Soft delete; a transfer always leaves (and returns) with both legs. */
  async trash(id: string): Promise<TransactionRow> {
    const current = assertLive(await this.repo.findById(id), "Lançamento");
    const now = new Date();
    const ids = current.transferGroupId ? (await this.repo.findGroup(current.transferGroupId)).map((t) => t.id) : [id];
    await this.repo.updateLegs(ids.map((x) => ({ id: x, values: { deletedAt: now } })));
    return current;
  }
  async restore(id: string): Promise<Transaction> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Lançamento não encontrado");
    if (!row.deletedAt) throw conflict("O lançamento não está na lixeira");
    const legs = row.transferGroupId ? await this.repo.findGroup(row.transferGroupId) : [row];
    for (const leg of legs) assertLive(await this.accounts.findById(leg.accountId), "Conta");
    await this.repo.updateLegs(legs.map((leg) => ({ id: leg.id, values: { deletedAt: null } })));
    return this.get(id);
  }

  /* ---------- reports ---------- */
  async monthlySummary(months: number, today: string): Promise<MonthSummary[]> {
    const firstMonth = addMonths(`${today.slice(0, 7)}-01`, -(months - 1)).slice(0, 7);
    const rows = new Map((await this.repo.monthly(firstMonth)).map((r) => [r.month, r]));
    const out: MonthSummary[] = [];
    for (let i = 0; i < months; i++) {
      const month = addMonths(`${firstMonth}-01`, i).slice(0, 7);
      const r = rows.get(month);
      const income = r?.income ?? 0;
      const expense = r?.expense ?? 0;
      out.push({ month, incomeCents: income, expenseCents: expense, netCents: income - expense });
    }
    return out;
  }
  async byCategory(month: string): Promise<CategoryTotal[]> {
    return (await this.repo.expensesByCategory(month)).map((r) => ({ categoryId: r.top_category_id, name: r.name, totalCents: r.total }));
  }
  /** One point per day from `from` to `to` (inclusive), carrying the balance forward. */
  async balanceSeries(from: string, to: string): Promise<BalancePoint[]> {
    if (to < from) throw badRequest("Período inválido");
    const { base, daily } = await this.repo.balanceSeries(from, to);
    const net = new Map(daily.map((d) => [d.date, d.net]));
    const out: BalancePoint[] = [];
    let balance = base;
    for (let d = from, i = 0; d <= to && i < 800; d = addDays(d, 1), i++) {
      balance += net.get(d) ?? 0;
      out.push({ date: d, balanceCents: balance });
    }
    return out;
  }
}

function toTxDto(r: TransactionRow, counterpart: string | null): Transaction {
  return {
    id: r.id, accountId: r.accountId, categoryId: r.categoryId, contactId: r.contactId, receiptFileId: r.receiptFileId, kind: r.kind,
    status: r.status, amountCents: r.amountCents, date: r.date, description: r.description, notes: r.notes,
    transferGroupId: r.transferGroupId, counterpartAccountId: counterpart, createdAt: isoRequired(r.createdAt),
  };
}
