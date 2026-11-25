import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { uuidv7 } from "../../src/shared/uuid";
import { createDb } from "../../src/worker/db/client";
import * as s from "../../src/worker/db/schema";

const db = createDb(env.DB);
const fails = (p: Promise<unknown>) => expect(p).rejects.toThrow();

describe("database integrity", () => {
  it("has foreign keys enforced and a clean database", async () => {
    expect(await env.DB.prepare("pragma foreign_keys").first("foreign_keys")).toBe(1);
    expect(await env.DB.prepare("pragma quick_check").first("quick_check")).toBe("ok");
    expect((await env.DB.prepare("pragma foreign_key_check").all()).results).toHaveLength(0);
  });

  it("applies UUIDv7 ids and UTC timestamps by default", async () => {
    const before = Date.now();
    const [area] = await db.insert(s.areas).values({ name: "Saúde" }).returning();
    expect(area?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(area?.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("DB-level defaults work for raw SQL inserts (restore path)", async () => {
    const id = uuidv7();
    await env.DB.prepare("insert into tags (id, name) values (?, ?)").bind(id, `raw-${id}`).run();
    const row = await env.DB.prepare("select created_at from tags where id = ?").bind(id).first<{ created_at: number }>();
    expect(row?.created_at).toBeGreaterThan(1_700_000_000_000);
  });

  it("rejects dangling foreign keys", async () => {
    await fails(db.insert(s.tasks).values({ title: "x", projectId: uuidv7() }));
  });

  it("enforces the PARA single-location rule", async () => {
    const [area] = await db.insert(s.areas).values({ name: "Carreira" }).returning();
    const [project] = await db.insert(s.projects).values({ name: "Site", areaId: area!.id }).returning();
    await fails(db.insert(s.tasks).values({ title: "both", projectId: project!.id, areaId: area!.id }));
    await fails(db.insert(s.notes).values({ title: "n", projectId: project!.id, areaId: area!.id }));
  });

  it("enforces enum, date-format and range CHECK constraints", async () => {
    await fails(env.DB.prepare("insert into tasks (id, title, status) values (?, 'x', 'bogus')").bind(uuidv7()).run());
    await fails(db.insert(s.tasks).values({ title: "x", dueDate: "25/11/2026" }));
    await fails(db.insert(s.books).values({ title: "b", rating: 6 }));
  });

  it("cascades project deletion to tasks and subtasks", async () => {
    const [project] = await db.insert(s.projects).values({ name: "Temp" }).returning();
    const [parent] = await db.insert(s.tasks).values({ title: "p", projectId: project!.id }).returning();
    await db.insert(s.tasks).values({ title: "child", parentTaskId: parent!.id });
    await db.delete(s.projects).where(eq(s.projects.id, project!.id));
    const left = await db.select().from(s.tasks).where(eq(s.tasks.parentTaskId, parent!.id));
    expect(left).toHaveLength(0);
  });

  it("tags are unique case-insensitively", async () => {
    const name = `Ideia-${uuidv7()}`;
    await db.insert(s.tags).values({ name });
    await fails(db.insert(s.tags).values({ name: name.toUpperCase() }));
  });

  it("allows one live journal entry per day, but a new one after soft delete", async () => {
    const day = "2031-01-15";
    const [first] = await db.insert(s.journalEntries).values({ entryDate: day }).returning();
    await fails(db.insert(s.journalEntries).values({ entryDate: day }));
    await db.update(s.journalEntries).set({ deletedAt: new Date() }).where(eq(s.journalEntries.id, first!.id));
    await expect(db.insert(s.journalEntries).values({ entryDate: day })).resolves.toBeDefined();
  });

  it("keeps one habit log per habit per day", async () => {
    const [habit] = await db.insert(s.habits).values({ name: "Ler" }).returning();
    await db.insert(s.habitLogs).values({ habitId: habit!.id, date: "2026-11-25" });
    await fails(db.insert(s.habitLogs).values({ habitId: habit!.id, date: "2026-11-25" }));
  });

  describe("finance", () => {
    it("stores integer cents and enforces sign by kind", async () => {
      const [acc] = await db.insert(s.accounts).values({ name: "Conta", openingBalanceCents: 100_00 }).returning();
      await db.insert(s.transactions).values([
        { accountId: acc!.id, kind: "income", amountCents: 2500_00, date: "2026-11-01", description: "Salário" },
        { accountId: acc!.id, kind: "expense", amountCents: -19_90, date: "2026-11-02", description: "Café" },
      ]);
      await fails(db.insert(s.transactions).values({ accountId: acc!.id, kind: "expense", amountCents: 500, date: "2026-11-03", description: "wrong sign" }));
      await fails(db.insert(s.transactions).values({ accountId: acc!.id, kind: "transfer", amountCents: -500, date: "2026-11-03", description: "no group" }));

      const row = await env.DB.prepare(
        "select a.opening_balance_cents + coalesce(sum(t.amount_cents), 0) as balance from accounts a left join transactions t on t.account_id = a.id and t.deleted_at is null where a.id = ?",
      ).bind(acc!.id).first<{ balance: number }>();
      expect(row?.balance).toBe(100_00 + 2500_00 - 19_90); // 2580.10 exactly, no float drift
    });

    it("prevents deleting an account that has transactions", async () => {
      const [acc] = await db.insert(s.accounts).values({ name: "Restrita" }).returning();
      await db.insert(s.transactions).values({ accountId: acc!.id, kind: "income", amountCents: 1, date: "2026-11-01", description: "x" });
      await fails(db.delete(s.accounts).where(eq(s.accounts.id, acc!.id)));
    });
  });
});
