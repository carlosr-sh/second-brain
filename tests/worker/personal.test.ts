import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/shared/knowledge";
import type { Account, BalancePoint, Category, CategoryTotal, Contact, ContactDetail, Habit, JournalEntry, MonthSummary, Transaction } from "../../src/shared/personal";
import type { TrashItem } from "../../src/shared/para";
import { isoDateIn } from "../../src/shared/time";
import { addDays } from "../../src/shared/dates";
import { nextBirthday } from "../../src/worker/services/personal/life.service";
import { createFakeAccess } from "../helpers/access";
import { makeApi, makeClient } from "../helpers/app";

let api: ReturnType<typeof makeApi>;
const today = () => isoDateIn(new Date());
const month = () => today().slice(0, 7);

beforeAll(async () => {
  const fake = await createFakeAccess();
  api = makeApi(makeClient(fake.keyResolver), await fake.sign());
});

beforeEach(async () => {
  // Subcategories first: parent_id is ON DELETE RESTRICT (checked row by row).
  await env.DB.prepare("delete from transactions").run();
  await env.DB.prepare("delete from financial_categories where parent_id is not null").run();
  for (const t of ["financial_categories", "accounts", "habit_logs", "habits", "journal_entries", "contact_interactions", "contacts", "audit_logs"]) {
    await env.DB.prepare(`delete from ${t}`).run();
  }
});

const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;
const balanceOf = async (id: string) => (await api.ok<Account[]>("GET", "/api/accounts")).find((a) => a.id === id)!.balanceCents;

describe("finance", () => {
  it("applies the sign from the kind and keeps exact cents", async () => {
    const acc = await api.ok<Account>("POST", "/api/accounts", { name: "Nubank", openingBalanceCents: 100_00 });
    await api.ok("POST", "/api/transactions", { accountId: acc.id, kind: "income", amountCents: 3500_00, date: today(), description: "Salário" });
    const coffee = await api.ok<Transaction>("POST", "/api/transactions", { accountId: acc.id, kind: "expense", amountCents: 7_90, date: today(), description: "Café" });
    expect(coffee.amountCents).toBe(-790);
    for (let i = 0; i < 10; i++) await api.ok("POST", "/api/transactions", { accountId: acc.id, kind: "expense", amountCents: 10, date: today(), description: `centavos ${i}` });
    expect(await balanceOf(acc.id)).toBe(100_00 + 3500_00 - 7_90 - 1_00); // 3591.10 exactly
    expect((await api.req("POST", "/api/transactions", { accountId: acc.id, kind: "expense", amountCents: -5, date: today(), description: "x" })).status).toBe(400);
    expect((await api.req("POST", "/api/transactions", { accountId: acc.id, kind: "expense", amountCents: 1.5, date: today(), description: "x" })).status).toBe(400);

    // switching kind flips the sign
    const flipped = await api.ok<Transaction>("PATCH", `/api/transactions/${coffee.id}`, { kind: "income" });
    expect(flipped.amountCents).toBe(790);
  });

  it("transfers atomically: two legs, sum zero, edit and delete both", async () => {
    const a = await api.ok<Account>("POST", "/api/accounts", { name: "Corrente", openingBalanceCents: 1000_00 });
    const b = await api.ok<Account>("POST", "/api/accounts", { name: "Cartão", type: "credit_card", openingBalanceCents: -450_00 });
    const legs = await api.ok<Transaction[]>("POST", "/api/transactions/transfer", { fromAccountId: a.id, toAccountId: b.id, amountCents: 450_00, date: today() });
    expect(legs.map((l) => l.amountCents).reduce((x, y) => x + y)).toBe(0);
    expect(legs[0]?.counterpartAccountId).toBe(b.id);
    expect([await balanceOf(a.id), await balanceOf(b.id)]).toEqual([550_00, 0]);

    await api.ok("PATCH", `/api/transactions/${legs[1]!.id}`, { amountCents: 400_00 });
    expect([await balanceOf(a.id), await balanceOf(b.id)]).toEqual([600_00, -50_00]);
    expect((await api.req("PATCH", `/api/transactions/${legs[0]!.id}`, { categoryId: null })).status).toBe(400);
    expect((await api.req("POST", "/api/transactions/transfer", { fromAccountId: a.id, toAccountId: a.id, amountCents: 1, date: today() })).status).toBe(400);

    await api.ok("DELETE", `/api/transactions/${legs[0]!.id}`);
    expect([await balanceOf(a.id), await balanceOf(b.id)]).toEqual([1000_00, -450_00]);
    const trash = await api.ok<TrashItem[]>("GET", "/api/trash");
    expect(trash.filter((t) => t.entity === "transaction")).toHaveLength(1); // one row per transfer
    await api.ok("POST", `/api/transactions/${legs[1]!.id}/restore`);
    expect([await balanceOf(a.id), await balanceOf(b.id)]).toEqual([600_00, -50_00]);
    expect(await env.DB.prepare("select count(*) n from audit_logs where action = 'finance.transaction.trash'").first("n")).toBe(1);
  });

  it("categories: defaults are idempotent; kind must match; two levels max", async () => {
    const first = await api.ok<{ created: number }>("POST", "/api/categories/defaults");
    expect(first.created).toBeGreaterThan(10);
    expect(await api.ok<{ created: number }>("POST", "/api/categories/defaults")).toEqual({ created: 0 });
    const cats = await api.ok<Category[]>("GET", "/api/categories");
    const salary = cats.find((c) => c.name === "Salário")!;
    const market = cats.find((c) => c.name === "Mercado")!;
    const acc = await api.ok<Account>("POST", "/api/accounts", { name: "C" });
    expect((await api.req("POST", "/api/transactions", { accountId: acc.id, kind: "expense", amountCents: 100, date: today(), description: "x", categoryId: salary.id })).status).toBe(400);
    expect(await code(await api.req("POST", "/api/categories", { name: "Neta", kind: "expense", parentId: market.id }))).toBe("CONFLICT");
    expect(await code(await api.req("DELETE", `/api/categories/${cats.find((c) => c.name === "Alimentação")!.id}`))).toBe("CONFLICT"); // has children
  });

  it("reports: monthly summary excludes transfers; expenses roll up to parent categories; balance series", async () => {
    await api.ok("POST", "/api/categories/defaults");
    const cats = await api.ok<Category[]>("GET", "/api/categories");
    const id = (n: string) => cats.find((c) => c.name === n)!.id;
    const a = await api.ok<Account>("POST", "/api/accounts", { name: "A", openingBalanceCents: 0 });
    const b = await api.ok<Account>("POST", "/api/accounts", { name: "B" });
    const t = today();
    await api.ok("POST", "/api/transactions", { accountId: a.id, kind: "income", amountCents: 5000_00, date: t, description: "Salário", categoryId: id("Salário") });
    await api.ok("POST", "/api/transactions", { accountId: a.id, kind: "expense", amountCents: 300_00, date: t, description: "Feira", categoryId: id("Mercado") });
    await api.ok("POST", "/api/transactions", { accountId: a.id, kind: "expense", amountCents: 120_50, date: t, description: "Jantar", categoryId: id("Restaurantes") });
    await api.ok("POST", "/api/transactions", { accountId: a.id, kind: "expense", amountCents: 80_00, date: t, description: "Sem categoria" });
    await api.ok("POST", "/api/transactions/transfer", { fromAccountId: a.id, toAccountId: b.id, amountCents: 1000_00, date: t });

    const summary = await api.ok<MonthSummary[]>("GET", "/api/finance/summary?months=3");
    expect(summary).toHaveLength(3);
    expect(summary.at(-1)).toEqual({ month: month(), incomeCents: 5000_00, expenseCents: 500_50, netCents: 4499_50 });
    const byCat = await api.ok<CategoryTotal[]>("GET", `/api/finance/by-category?month=${month()}`);
    expect(byCat.map((c) => [c.name, c.totalCents])).toEqual([["Alimentação", 420_50], ["Sem categoria", 80_00]]);
    const series = await api.ok<BalancePoint[]>("GET", `/api/finance/balance?from=${addDays(t, -2)}&to=${t}`);
    expect(series.map((p) => p.balanceCents)).toEqual([0, 0, 4499_50]); // transfer is net zero across accounts
  });

  it("accounts with transactions are archived, not deleted; archived accounts reject new entries", async () => {
    const acc = await api.ok<Account>("POST", "/api/accounts", { name: "Antiga" });
    await api.ok("POST", "/api/transactions", { accountId: acc.id, kind: "income", amountCents: 1, date: today(), description: "x" });
    expect(await code(await api.req("DELETE", `/api/accounts/${acc.id}`))).toBe("CONFLICT");
    await api.ok("PATCH", `/api/accounts/${acc.id}`, { archived: true });
    expect(await code(await api.req("POST", "/api/transactions", { accountId: acc.id, kind: "income", amountCents: 1, date: today(), description: "y" }))).toBe("CONFLICT");
    const empty = await api.ok<Account>("POST", "/api/accounts", { name: "Vazia" });
    await api.ok("DELETE", `/api/accounts/${empty.id}`);
    await api.ok("DELETE", `/api/trash/account/${empty.id}`);
  });
});

describe("habits", () => {
  it("check-ins are one per day, update streaks and reject future days", async () => {
    const h = await api.ok<Habit>("POST", "/api/habits", { name: "Ler 20 min" });
    const t = today();
    await api.ok("PUT", `/api/habits/${h.id}/logs/${addDays(t, -2)}`, { count: 1 });
    await api.ok("PUT", `/api/habits/${h.id}/logs/${addDays(t, -1)}`, { count: 1 });
    let after = await api.ok<Habit>("PUT", `/api/habits/${h.id}/logs/${t}`, { count: 1 });
    after = await api.ok<Habit>("PUT", `/api/habits/${h.id}/logs/${t}`, { count: 1 }); // idempotent upsert
    expect(after.stats).toMatchObject({ currentStreak: 3, longestStreak: 3, currentPeriodCount: 1 });
    expect(await env.DB.prepare("select count(*) n from habit_logs where habit_id = ?").bind(h.id).first("n")).toBe(3);
    const cleared = await api.ok<Habit>("PUT", `/api/habits/${h.id}/logs/${t}`, { count: 0 });
    expect(cleared.stats.currentStreak).toBe(2); // today not done yet doesn't break it
    expect(await code(await api.req("PUT", `/api/habits/${h.id}/logs/${addDays(t, 1)}`, { count: 1 }))).toBe("CONFLICT");
    expect((await api.req("PUT", `/api/habits/${h.id}/logs/2026-02-30`, { count: 1 })).status).toBe(400);
  });
});

describe("journal", () => {
  const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

  it("one live entry per day (upsert), searchable, recreatable after trash", async () => {
    const d = "2026-11-20";
    const e1 = await api.ok<JournalEntry>("PUT", `/api/journal/${d}`, { content: doc("Dia de gratidão e reflexão"), mood: 4 });
    const e2 = await api.ok<JournalEntry>("PUT", `/api/journal/${d}`, { energy: 2 });
    expect(e2).toMatchObject({ id: e1.id, mood: 4, energy: 2 });
    expect(await env.DB.prepare("select count(*) n from journal_entries").first("n")).toBe(1);

    const results = await api.ok<SearchResult[]>("GET", "/api/search?q=gratidao&types=journal");
    expect(results[0]?.title.replace(/[\u0002\u0003]/g, "")).toMatch(/^2026-11-20/);

    await api.ok("DELETE", `/api/journals/${e1.id}`);
    expect((await api.req("GET", `/api/journal/${d}`)).status).toBe(404);
    const fresh = await api.ok<JournalEntry>("PUT", `/api/journal/${d}`, { content: doc("novo") });
    expect(fresh.id).not.toBe(e1.id);
    expect(await code(await api.req("POST", `/api/journals/${e1.id}/restore`))).toBe("CONFLICT"); // day taken
    expect((await api.ok<{ date: string }[]>("GET", "/api/journal?from=2026-11-01&to=2026-11-30")).map((x) => x.date)).toEqual([d]);
  });

  it("rejects malicious content", async () => {
    const res = await api.req("PUT", "/api/journal/2026-11-21", { content: { type: "doc", content: [{ type: "script" }] } });
    expect(res.status).toBe(400);
  });
});

describe("contacts", () => {
  it("derives last contact, due cadence and birthdays (unknown year)", async () => {
    const c = await api.ok<ContactDetail>("POST", "/api/contacts", { name: "Ana", contactFrequencyDays: 30, birthday: "0000-02-29", email: "ana@example.com" });
    expect(c.due).toBe(true); // never contacted
    const after = await api.ok<ContactDetail>("POST", `/api/contacts/${c.id}/interactions`, { type: "call", summary: "Conversamos sobre o projeto" });
    expect(after.due).toBe(false);
    expect(after.interactions).toHaveLength(1);
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await api.ok("DELETE", `/api/contacts/${c.id}/interactions/${after.interactions[0]!.id}`);
    const due = await api.ok<ContactDetail>("POST", `/api/contacts/${c.id}/interactions`, { summary: "antiga", occurredAt: old });
    expect(due.due).toBe(true);
    expect((await api.req("POST", `/api/contacts/${c.id}/interactions`, { summary: "x", occurredAt: new Date(Date.now() + 86_400_000 * 2).toISOString() })).status).toBe(409);

    expect((await api.req("POST", "/api/contacts", { name: "x", birthday: "2023-02-29" })).status).toBe(400);
    expect((await api.req("POST", "/api/contacts", { name: "x", email: "não-é-email" })).status).toBe(400);
    const list = await api.ok<Contact[]>("GET", "/api/contacts");
    expect(list[0]?.nextBirthday?.slice(5)).toMatch(/^02-2[89]$/);
    expect((await api.ok<SearchResult[]>("GET", "/api/search?q=ana&types=contact"))).toHaveLength(1);
  });

  it("nextBirthday handles Feb 29 and year rollover", () => {
    expect(nextBirthday("0000-02-29", "2027-01-10")).toEqual({ date: "2027-02-28", days: 49 });
    expect(nextBirthday("1990-01-05", "2026-11-25")).toEqual({ date: "2027-01-05", days: 41 });
    expect(nextBirthday("1990-11-25", "2026-11-25")).toEqual({ date: "2026-11-25", days: 0 });
  });
});

describe("transfer atomicity (repository level)", () => {
  it("if the second leg fails, the first leg is NOT persisted", async () => {
    const { createDb } = await import("../../src/worker/db/client");
    const { TransactionRepository } = await import("../../src/worker/repositories/personal/finance.repository");
    const repo = new TransactionRepository(createDb(env.DB), env.DB);
    const acc = await api.ok<Account>("POST", "/api/accounts", { name: "Origem" });
    const group = "0190a0a0-0000-7000-8000-0000000000ff";
    const base = { kind: "transfer" as const, date: "2026-11-25", description: "t", transferGroupId: group };
    await expect(
      repo.insertTransfer(
        { ...base, accountId: acc.id, amountCents: -100 },
        { ...base, accountId: "0190a0a0-0000-7000-8000-000000000999", amountCents: 100 }, // FK violation
      ),
    ).rejects.toThrow();
    expect(await env.DB.prepare("select count(*) n from transactions where transfer_group_id = ?").bind(group).first("n")).toBe(0);
  });
});
