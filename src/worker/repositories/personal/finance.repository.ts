import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/client";
import { accounts, financialCategories, transactions } from "../../db/schema";

export type AccountRow = typeof accounts.$inferSelect;
export type CategoryRow = typeof financialCategories.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

const A = sql.raw("accounts.id"); // qualified outer reference (see docs: correlated subqueries)

export class AccountRepository {
  constructor(private readonly db: Database) {}

  list(archived: boolean) {
    return this.db
      .select({
        account: accounts,
        balance: sql<number>`${accounts.openingBalanceCents} + (select coalesce(sum(t.amount_cents), 0) from transactions t where t.account_id = ${A} and t.deleted_at is null)`,
        cleared: sql<number>`${accounts.openingBalanceCents} + (select coalesce(sum(t.amount_cents), 0) from transactions t where t.account_id = ${A} and t.deleted_at is null and t.status = 'cleared')`,
        txCount: sql<number>`(select count(*) from transactions t where t.account_id = ${A} and t.deleted_at is null)`,
      })
      .from(accounts)
      .where(and(isNull(accounts.deletedAt), archived ? isNotNull(accounts.archivedAt) : isNull(accounts.archivedAt)))
      .orderBy(asc(accounts.name));
  }

  async findById(id: string): Promise<AccountRow | undefined> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return row;
  }

  async liveTransactionCount(id: string): Promise<number> {
    const [r] = await this.db.select({ n: sql<number>`count(*)` }).from(transactions).where(and(eq(transactions.accountId, id), isNull(transactions.deletedAt)));
    return r?.n ?? 0;
  }

  async insert(values: typeof accounts.$inferInsert): Promise<AccountRow> {
    const [row] = await this.db.insert(accounts).values(values).returning();
    if (!row) throw new Error("account insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof accounts.$inferInsert>) {
    await this.db.update(accounts).set(values).where(eq(accounts.id, id));
  }

  async purge(id: string) {
    await this.db.delete(accounts).where(eq(accounts.id, id)); // FK RESTRICT if transactions exist
  }
}

export class CategoryRepository {
  constructor(private readonly db: Database) {}

  list(includeArchived: boolean) {
    const where: SQL[] = [isNull(financialCategories.deletedAt)];
    if (!includeArchived) where.push(isNull(financialCategories.archivedAt));
    return this.db.select().from(financialCategories).where(and(...where)).orderBy(asc(financialCategories.kind), asc(financialCategories.name));
  }

  async findById(id: string): Promise<CategoryRow | undefined> {
    const [row] = await this.db.select().from(financialCategories).where(eq(financialCategories.id, id));
    return row;
  }

  async usage(id: string): Promise<{ children: number; transactions: number }> {
    const [c] = await this.db.select({ n: sql<number>`count(*)` }).from(financialCategories).where(and(eq(financialCategories.parentId, id), isNull(financialCategories.deletedAt)));
    const [t] = await this.db.select({ n: sql<number>`count(*)` }).from(transactions).where(and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)));
    return { children: c?.n ?? 0, transactions: t?.n ?? 0 };
  }

  async insert(values: typeof financialCategories.$inferInsert): Promise<CategoryRow> {
    const [row] = await this.db.insert(financialCategories).values(values).returning();
    if (!row) throw new Error("category insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof financialCategories.$inferInsert>) {
    await this.db.update(financialCategories).set(values).where(eq(financialCategories.id, id));
  }

  async purge(id: string) {
    await this.db.delete(financialCategories).where(eq(financialCategories.id, id));
  }
}

export class TransactionRepository {
  constructor(private readonly db: Database, private readonly d1: D1Database) {}

  list(f: { from?: string; to?: string; accountId?: string; categoryId?: string; kind?: string }) {
    const where: SQL[] = [isNull(transactions.deletedAt)];
    if (f.from) where.push(gte(transactions.date, f.from));
    if (f.to) where.push(lt(transactions.date, f.to));
    if (f.accountId) where.push(eq(transactions.accountId, f.accountId));
    if (f.categoryId) where.push(sql`(${transactions.categoryId} = ${f.categoryId} or ${transactions.categoryId} in (select id from financial_categories where parent_id = ${f.categoryId}))`);
    if (f.kind) where.push(sql`${transactions.kind} = ${f.kind}`);
    return this.db
      .select({
        tx: transactions,
        counterpart: sql<string | null>`(select o.account_id from transactions o where o.transfer_group_id = ${transactions.transferGroupId} and o.id <> ${transactions.id} limit 1)`,
      })
      .from(transactions)
      .where(and(...where))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(2000);
  }

  async findById(id: string): Promise<TransactionRow | undefined> {
    const [row] = await this.db.select().from(transactions).where(eq(transactions.id, id));
    return row;
  }

  findGroup(groupId: string): Promise<TransactionRow[]> {
    return this.db.select().from(transactions).where(eq(transactions.transferGroupId, groupId));
  }

  async insert(values: NewTransaction): Promise<TransactionRow> {
    const [row] = await this.db.insert(transactions).values(values).returning();
    if (!row) throw new Error("transaction insert returned no row");
    return row;
  }

  /** Both legs of a transfer in ONE atomic batch. */
  async insertTransfer(out: NewTransaction, inn: NewTransaction): Promise<[TransactionRow, TransactionRow]> {
    const [a, b] = await this.db.batch([this.db.insert(transactions).values(out).returning(), this.db.insert(transactions).values(inn).returning()]);
    if (!a[0] || !b[0]) throw new Error("transfer insert returned no rows");
    return [a[0], b[0]];
  }

  async update(id: string, values: Partial<NewTransaction>) {
    await this.db.update(transactions).set(values).where(eq(transactions.id, id));
  }

  /** Updates every leg of a transfer group atomically (one statement per leg in a batch). */
  async updateLegs(updates: { id: string; values: Partial<NewTransaction> }[]) {
    const [first, ...rest] = updates.map((u) => this.db.update(transactions).set(u.values).where(eq(transactions.id, u.id)));
    if (!first) return;
    await this.db.batch([first, ...rest]);
  }

  async purge(id: string) {
    const row = await this.findById(id);
    if (row?.transferGroupId) await this.db.delete(transactions).where(eq(transactions.transferGroupId, row.transferGroupId));
    else await this.db.delete(transactions).where(eq(transactions.id, id));
  }

  /* ---------- reports (transfers excluded: they are internal moves) ---------- */
  async monthly(fromMonth: string) {
    const { results } = await this.d1
      .prepare(
        `select substr(date, 1, 7) as month,
                coalesce(sum(case when kind = 'income' then amount_cents end), 0) as income,
                coalesce(-sum(case when kind = 'expense' then amount_cents end), 0) as expense
           from transactions where deleted_at is null and kind in ('income', 'expense') and date >= ?1
          group by month order by month`,
      )
      .bind(`${fromMonth}-01`)
      .all<{ month: string; income: number; expense: number }>();
    return results;
  }

  /** Expenses of a month rolled up to top-level categories. */
  async expensesByCategory(month: string) {
    const { results } = await this.d1
      .prepare(
        // NOTE: the alias must NOT be named like a real column (e.g. "category_id"):
        // SQLite resolves GROUP BY names to table columns before aliases.
        `select coalesce(c.parent_id, c.id) as top_category_id,
                coalesce(p.name, c.name, 'Sem categoria') as name,
                -sum(t.amount_cents) as total
           from transactions t
           left join financial_categories c on c.id = t.category_id
           left join financial_categories p on p.id = c.parent_id
          where t.deleted_at is null and t.kind = 'expense' and substr(t.date, 1, 7) = ?1
          group by top_category_id order by total desc`,
      )
      .bind(month)
      .all<{ top_category_id: string | null; name: string; total: number }>();
    return results;
  }

  /** Total balance (all live accounts) at the start of `from`, plus daily net changes until `to`. */
  async balanceSeries(from: string, to: string) {
    const [base, daily] = await this.d1.batch<{ base?: number; date?: string; net?: number }>([
      this.d1.prepare(
        `select (select coalesce(sum(opening_balance_cents), 0) from accounts where deleted_at is null)
              + (select coalesce(sum(t.amount_cents), 0) from transactions t join accounts a on a.id = t.account_id
                  where t.deleted_at is null and a.deleted_at is null and t.date < ?1) as base`,
      ).bind(from),
      this.d1.prepare(
        `select t.date as date, sum(t.amount_cents) as net from transactions t join accounts a on a.id = t.account_id
          where t.deleted_at is null and a.deleted_at is null and t.date >= ?1 and t.date <= ?2
          group by t.date order by t.date`,
      ).bind(from, to),
    ]);
    return { base: base?.results[0]?.base ?? 0, daily: (daily?.results ?? []) as { date: string; net: number }[] };
  }
}
