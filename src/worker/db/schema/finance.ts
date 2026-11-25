import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { ACCOUNT_TYPE, CATEGORY_KIND, TRANSACTION_KIND, TRANSACTION_STATUS } from "../../../shared/enums";
import { archivable, dateColumn, enumCheck, id, isoDateCheck, softDelete, timestamps } from "./_helpers";
import { files } from "./files";
import { contacts } from "./personal";

/**
 * Financial accounts. The balance is NOT stored: it is always
 * opening_balance_cents + SUM(transactions.amount_cents), avoiding drift.
 */
export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    name: text("name").notNull(),
    type: text("type", { enum: ACCOUNT_TYPE }).notNull().default("checking"),
    /** ISO 4217 code. Transactions inherit the account currency. */
    currency: text("currency").notNull().default("BRL"),
    openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
    institution: text("institution"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    enumCheck("accounts_type_ck", t.type, ACCOUNT_TYPE),
    check("accounts_currency_ck", sql`length(${t.currency}) = 3 and ${t.currency} = upper(${t.currency})`),
  ],
);

export const financialCategories = sqliteTable(
  "financial_categories",
  {
    id: id(),
    parentId: text("parent_id").references((): AnySQLiteColumn => financialCategories.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    kind: text("kind", { enum: CATEGORY_KIND }).notNull(),
    color: text("color"),
    icon: text("icon"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("financial_categories_parent_idx").on(t.parentId),
    enumCheck("financial_categories_kind_ck", t.kind, CATEGORY_KIND),
    check("financial_categories_not_own_parent_ck", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
  ],
);

/**
 * Transactions. `amount_cents` is SIGNED: negative = money leaving the account.
 * A transfer is two rows (one per account) sharing `transfer_group_id`; the
 * service layer guarantees both legs are written atomically (D1 batch) and
 * sum to zero.
 */
export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: text("category_id").references(() => financialCategories.id, { onDelete: "set null" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    receiptFileId: text("receipt_file_id").references(() => files.id, { onDelete: "set null" }),
    kind: text("kind", { enum: TRANSACTION_KIND }).notNull(),
    status: text("status", { enum: TRANSACTION_STATUS }).notNull().default("cleared"),
    amountCents: integer("amount_cents").notNull(),
    date: dateColumn("date").notNull(),
    description: text("description").notNull(),
    notes: text("notes"),
    transferGroupId: text("transfer_group_id"),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("transactions_account_date_idx").on(t.accountId, t.date),
    index("transactions_category_date_idx").on(t.categoryId, t.date),
    index("transactions_date_idx").on(t.date),
    index("transactions_transfer_group_idx").on(t.transferGroupId),
    enumCheck("transactions_kind_ck", t.kind, TRANSACTION_KIND),
    enumCheck("transactions_status_ck", t.status, TRANSACTION_STATUS),
    isoDateCheck("transactions_date_ck", t.date),
    check("transactions_amount_nonzero_ck", sql`${t.amountCents} <> 0`),
    check(
      "transactions_sign_ck",
      sql`(${t.kind} = 'income' and ${t.amountCents} > 0) or (${t.kind} = 'expense' and ${t.amountCents} < 0) or ${t.kind} in ('transfer', 'adjustment')`,
    ),
    check(
      "transactions_transfer_group_ck",
      sql`(${t.kind} = 'transfer') = (${t.transferGroupId} is not null)`,
    ),
  ],
);
