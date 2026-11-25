import { z } from "./z";
import { isoDateSchema } from "./dates";
import { ACCOUNT_TYPE, CATEGORY_KIND, CONTACT_RELATIONSHIP, HABIT_FREQUENCY, INTERACTION_TYPE, TRANSACTION_STATUS } from "./enums";
import { amountCentsSchema, signedCentsSchema } from "./money";
import { richDocSchema, type RichDoc } from "./rich-text";
import { UUID_REGEX } from "./uuid";

const id = z.string().regex(UUID_REGEX, "ID inválido").transform((v) => v.toLowerCase());
const nullableId = id.nullable();
const name = z.string().trim().min(1, "Obrigatório").max(200);
const shortText = z.string().trim().max(200);
const longText = z.string().max(20_000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const nonEmpty = <T extends z.ZodObject>(s: T) => s.refine((v) => Object.keys(v).length > 0, "Nenhum campo para atualizar");
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido (AAAA-MM)");

/* ---------------- finance ---------------- */
export const createAccountSchema = z.object({
  name,
  type: z.enum(ACCOUNT_TYPE).optional(),
  openingBalanceCents: signedCentsSchema.optional(),
  institution: shortText.nullable().optional(),
});
export const updateAccountSchema = nonEmpty(createAccountSchema.partial().extend({ archived: z.boolean().optional() }));

export const createCategorySchema = z.object({ name, kind: z.enum(CATEGORY_KIND), parentId: nullableId.optional(), color: color.nullable().optional() });
export const updateCategorySchema = nonEmpty(z.object({ name: name.optional(), color: color.nullable().optional(), archived: z.boolean().optional() }));

export const createTransactionSchema = z.object({
  accountId: id,
  kind: z.enum(["income", "expense"]),
  /** Always positive: the server applies the sign from `kind`. */
  amountCents: amountCentsSchema,
  date: isoDateSchema,
  description: name,
  categoryId: nullableId.optional(),
  contactId: nullableId.optional(),
  receiptFileId: nullableId.optional(),
  status: z.enum(TRANSACTION_STATUS).optional(),
  notes: longText.nullable().optional(),
});
export const createTransferSchema = z
  .object({ fromAccountId: id, toAccountId: id, amountCents: amountCentsSchema, date: isoDateSchema, description: shortText.optional(), notes: longText.nullable().optional() })
  .refine((v) => v.fromAccountId !== v.toAccountId, { message: "Escolha contas diferentes", path: ["toAccountId"] });
/** For transfers only amount/date/description/notes/status may change (applied to both legs). */
export const updateTransactionSchema = nonEmpty(createTransactionSchema.omit({ kind: true }).partial().extend({ kind: z.enum(["income", "expense"]).optional() }));
export const transactionListQuerySchema = z.object({
  month: monthSchema.optional(),
  accountId: id.optional(),
  categoryId: id.optional(),
  kind: z.enum(["income", "expense", "transfer"]).optional(),
});
export const summaryQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(36).default(12) });
export const byCategoryQuerySchema = z.object({ month: monthSchema });
export const balanceSeriesQuerySchema = z.object({ from: isoDateSchema, to: isoDateSchema });

/* ---------------- habits ---------------- */
export const createHabitSchema = z.object({
  name,
  description: longText.nullable().optional(),
  frequency: z.enum(HABIT_FREQUENCY).optional(),
  targetCount: z.number().int().min(1).max(100).optional(),
  color: color.nullable().optional(),
  areaId: nullableId.optional(),
  goalId: nullableId.optional(),
});
export const updateHabitSchema = nonEmpty(createHabitSchema.partial().extend({ archived: z.boolean().optional() }));
export const habitLogSchema = z.object({ count: z.number().int().min(0).max(100), note: shortText.nullable().optional() });

/* ---------------- journal ---------------- */
export const upsertJournalSchema = z.object({
  title: z.string().trim().max(300).nullable().optional(),
  content: richDocSchema.optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
});
export const journalListQuerySchema = z.object({ from: isoDateSchema, to: isoDateSchema });

/* ---------------- contacts ---------------- */
/** Birthday: YYYY-MM-DD, with year 0000 meaning "unknown year" (Feb 29 allowed then). */
export function isValidBirthday(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  if (y !== 0 && (y < 1900 || y > 2100)) return false;
  const leap = y === 0 || (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] as number;
  return d <= days;
}
export const birthdaySchema = z.string().refine(isValidBirthday, "Data de aniversário inválida (use 0000 se não souber o ano)");

export const createContactSchema = z.object({
  name,
  nickname: shortText.nullable().optional(),
  email: z.email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).regex(/^[0-9+()\-\s.]*$/, "Telefone inválido").nullable().optional(),
  company: shortText.nullable().optional(),
  jobTitle: shortText.nullable().optional(),
  relationship: z.enum(CONTACT_RELATIONSHIP).optional(),
  birthday: birthdaySchema.nullable().optional(),
  notes: longText.nullable().optional(),
  contactFrequencyDays: z.number().int().min(1).max(3650).nullable().optional(),
});
export const updateContactSchema = nonEmpty(createContactSchema.partial().extend({ archived: z.boolean().optional() }));
export const createInteractionSchema = z.object({
  type: z.enum(INTERACTION_TYPE).optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  summary: z.string().trim().min(1).max(5000),
});

/* ---------------- DTOs ---------------- */
export interface Account {
  id: string; name: string; type: (typeof ACCOUNT_TYPE)[number]; currency: "BRL"; institution: string | null;
  openingBalanceCents: number; balanceCents: number; clearedBalanceCents: number; transactionCount: number; archivedAt: string | null;
}
export interface Category { id: string; name: string; kind: (typeof CATEGORY_KIND)[number]; parentId: string | null; color: string | null; archivedAt: string | null }
export interface Transaction {
  id: string; accountId: string; categoryId: string | null; contactId: string | null; receiptFileId: string | null;
  kind: "income" | "expense" | "transfer" | "adjustment"; status: (typeof TRANSACTION_STATUS)[number];
  amountCents: number; date: string; description: string; notes: string | null;
  transferGroupId: string | null; /** For transfer legs: the other account. */ counterpartAccountId: string | null; createdAt: string;
}
export interface MonthSummary { month: string; incomeCents: number; expenseCents: number; netCents: number }
export interface CategoryTotal { categoryId: string | null; name: string; totalCents: number }
export interface BalancePoint { date: string; balanceCents: number }

export interface HabitStats { currentStreak: number; longestStreak: number; completionRate: number; currentPeriodCount: number }
export interface Habit {
  id: string; name: string; description: string | null; frequency: (typeof HABIT_FREQUENCY)[number]; targetCount: number;
  color: string | null; areaId: string | null; goalId: string | null; archivedAt: string | null;
  /** Logs of the last ~26 weeks, for the heatmap. */
  logs: { date: string; count: number }[]; stats: HabitStats;
}

export interface JournalSummary { id: string; date: string; title: string | null; excerpt: string; mood: number | null; energy: number | null }
export interface JournalEntry extends JournalSummary { content: RichDoc; updatedAt: string }

export interface Interaction { id: string; type: (typeof INTERACTION_TYPE)[number]; occurredAt: string; summary: string }
export interface Contact {
  id: string; name: string; nickname: string | null; email: string | null; phone: string | null; company: string | null;
  jobTitle: string | null; relationship: (typeof CONTACT_RELATIONSHIP)[number]; birthday: string | null; notes: string | null;
  contactFrequencyDays: number | null; lastContactedAt: string | null;
  /** True when the keep-in-touch cadence has elapsed. */ due: boolean;
  /** Next birthday date (YYYY-MM-DD) and days until it, if known. */ nextBirthday: string | null; daysToBirthday: number | null;
  archivedAt: string | null;
}
export interface ContactDetail extends Contact { interactions: Interaction[] }

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type UpsertJournalInput = z.infer<typeof upsertJournalSchema>;
