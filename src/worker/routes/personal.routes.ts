import { Hono, type Context } from "hono";
import type { ApiSuccess } from "../../shared/api";
import { isoDateSchema } from "../../shared/dates";
import { listArchivedQuerySchema } from "../../shared/para";
import {
  balanceSeriesQuerySchema, byCategoryQuerySchema, createAccountSchema, createCategorySchema, createContactSchema, createHabitSchema,
  createInteractionSchema, createTransactionSchema, createTransferSchema, habitLogSchema, journalListQuerySchema, summaryQuerySchema,
  transactionListQuerySchema, updateAccountSchema, updateCategorySchema, updateContactSchema, updateHabitSchema, updateTransactionSchema, upsertJournalSchema,
} from "../../shared/personal";
import { isoDateIn } from "../../shared/time";
import { AppError } from "../lib/errors";
import { requestMeta } from "../lib/request-meta";
import { parseIdParam, parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types";

const ok = <T>(c: Context<AppEnv>, data: T, status: 200 | 201 = 200) => c.json<ApiSuccess<T>>({ data }, status);
const idOf = (c: Context<AppEnv>, name = "id") => parseIdParam(c.req.param(name));
const archivedOf = (c: Context<AppEnv>) => listArchivedQuerySchema.parse(c.req.query()).archived === "true";
const noContent = (c: Context<AppEnv>) => c.body(null, 204);
const s = (c: Context<AppEnv>) => c.get("services");
const dateOf = (c: Context<AppEnv>) => {
  const parsed = isoDateSchema.safeParse(c.req.param("date"));
  if (!parsed.success) throw new AppError(400, "VALIDATION_FAILED", "Data inválida (AAAA-MM-DD)");
  return parsed.data;
};
const today = (c: Context<AppEnv>) => isoDateIn(new Date(), c.get("config").APP_TIMEZONE);

/* ---------------- finance ---------------- */
export const accountRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).accounts.list(archivedOf(c))))
  .post("/", async (c) => ok(c, await s(c).accounts.create(await parseJsonBody(c, createAccountSchema)), 201))
  .patch("/:id", async (c) => ok(c, await s(c).accounts.update(idOf(c), await parseJsonBody(c, updateAccountSchema))))
  .delete("/:id", async (c) => {
    const id = idOf(c);
    await s(c).accounts.trash(id);
    await s(c).audit.record(requestMeta(c), { action: "finance.account.trash", entityType: "account", entityId: id });
    return noContent(c);
  })
  .post("/:id/restore", async (c) => ok(c, await s(c).accounts.restore(idOf(c))));

export const categoryRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).categories.list(c.req.query("all") === "true")))
  .post("/", async (c) => ok(c, await s(c).categories.create(await parseJsonBody(c, createCategorySchema)), 201))
  .post("/defaults", async (c) => ok(c, await s(c).categories.seedDefaults()))
  .patch("/:id", async (c) => ok(c, await s(c).categories.update(idOf(c), await parseJsonBody(c, updateCategorySchema))))
  .delete("/:id", async (c) => (await s(c).categories.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).categories.restore(idOf(c))));

export const transactionRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).transactions.list(transactionListQuerySchema.parse(c.req.query()))))
  .post("/", async (c) => ok(c, await s(c).transactions.create(await parseJsonBody(c, createTransactionSchema)), 201))
  .post("/transfer", async (c) => ok(c, await s(c).transactions.transfer(await parseJsonBody(c, createTransferSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).transactions.get(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).transactions.update(idOf(c), await parseJsonBody(c, updateTransactionSchema))))
  .delete("/:id", async (c) => {
    const tx = await s(c).transactions.trash(idOf(c));
    await s(c).audit.record(requestMeta(c), {
      action: "finance.transaction.trash", entityType: "transaction", entityId: tx.id,
      metadata: { amountCents: tx.amountCents, date: tx.date, description: tx.description, transfer: !!tx.transferGroupId },
    });
    return noContent(c);
  })
  .post("/:id/restore", async (c) => ok(c, await s(c).transactions.restore(idOf(c))));

export const financeReportRoutes = new Hono<AppEnv>()
  .get("/summary", async (c) => ok(c, await s(c).transactions.monthlySummary(summaryQuerySchema.parse(c.req.query()).months, today(c))))
  .get("/by-category", async (c) => ok(c, await s(c).transactions.byCategory(byCategoryQuerySchema.parse(c.req.query()).month)))
  .get("/balance", async (c) => {
    const { from, to } = balanceSeriesQuerySchema.parse(c.req.query());
    return ok(c, await s(c).transactions.balanceSeries(from, to));
  });

/* ---------------- habits ---------------- */
export const habitRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).habits.list(archivedOf(c))))
  .post("/", async (c) => ok(c, await s(c).habits.create(await parseJsonBody(c, createHabitSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).habits.get(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).habits.update(idOf(c), await parseJsonBody(c, updateHabitSchema))))
  .put("/:id/logs/:date", async (c) => {
    const { count, note } = await parseJsonBody(c, habitLogSchema);
    return ok(c, await s(c).habits.log(idOf(c), dateOf(c), count, note));
  })
  .delete("/:id", async (c) => (await s(c).habits.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).habits.restore(idOf(c))));

/* ---------------- journal ---------------- */
export const journalRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { from, to } = journalListQuerySchema.parse(c.req.query());
    return ok(c, await s(c).journal.list(from, to));
  })
  .get("/:date", async (c) => ok(c, await s(c).journal.find(dateOf(c))))
  .put("/:date", async (c) => ok(c, await s(c).journal.upsert(dateOf(c), await parseJsonBody(c, upsertJournalSchema))));
/** By-id operations (trash/restore), consistent with ENTITY_PATH.journal = "journals". */
export const journalByIdRoutes = new Hono<AppEnv>()
  .delete("/:id", async (c) => (await s(c).journal.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).journal.restore(idOf(c))));

/* ---------------- contacts ---------------- */
export const contactRoutes = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await s(c).contacts.list(archivedOf(c))))
  .post("/", async (c) => ok(c, await s(c).contacts.create(await parseJsonBody(c, createContactSchema)), 201))
  .get("/:id", async (c) => ok(c, await s(c).contacts.get(idOf(c))))
  .patch("/:id", async (c) => ok(c, await s(c).contacts.update(idOf(c), await parseJsonBody(c, updateContactSchema))))
  .post("/:id/interactions", async (c) => ok(c, await s(c).contacts.addInteraction(idOf(c), await parseJsonBody(c, createInteractionSchema)), 201))
  .delete("/:id/interactions/:iid", async (c) => ok(c, await s(c).contacts.deleteInteraction(idOf(c), idOf(c, "iid"))))
  .delete("/:id", async (c) => (await s(c).contacts.trash(idOf(c)), noContent(c)))
  .post("/:id/restore", async (c) => ok(c, await s(c).contacts.restore(idOf(c))));

