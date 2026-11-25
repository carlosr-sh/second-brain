import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { CONTACT_RELATIONSHIP, HABIT_FREQUENCY, INTERACTION_TYPE } from "../../../shared/enums";
import {
  NOW_MS,
  archivable,
  dateColumn,
  enumCheck,
  id,
  isoDateCheck,
  softDelete,
  timestamps,
} from "./_helpers";
import { areas, goals } from "./para";

/** Habits. `target_count` = times expected per `frequency` period. */
export const habits = sqliteTable(
  "habits",
  {
    id: id(),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    frequency: text("frequency", { enum: HABIT_FREQUENCY }).notNull().default("daily"),
    targetCount: integer("target_count").notNull().default(1),
    color: text("color"),
    icon: text("icon"),
    startedOn: dateColumn("started_on"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("habits_area_idx").on(t.areaId),
    index("habits_goal_idx").on(t.goalId),
    enumCheck("habits_frequency_ck", t.frequency, HABIT_FREQUENCY),
    check("habits_target_ck", sql`${t.targetCount} >= 1`),
    isoDateCheck("habits_started_on_ck", t.startedOn),
  ],
);

/** Habit history: one row per habit per local calendar day. */
export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: id(),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    date: dateColumn("date").notNull(),
    count: integer("count").notNull().default(1),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("habit_logs_habit_date_uq").on(t.habitId, t.date),
    index("habit_logs_date_idx").on(t.date),
    isoDateCheck("habit_logs_date_ck", t.date),
    check("habit_logs_count_ck", sql`${t.count} >= 0`),
  ],
);

/** Daily journal: at most one live entry per local calendar day. */
export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: id(),
    entryDate: dateColumn("entry_date").notNull(),
    title: text("title"),
    contentJson: text("content_json", { mode: "json" }),
    contentText: text("content_text").notNull().default(""),
    mood: integer("mood"),
    energy: integer("energy"),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("journal_entries_date_live_uq").on(t.entryDate).where(sql`${t.deletedAt} is null`),
    isoDateCheck("journal_entries_date_ck", t.entryDate),
    check("journal_entries_mood_ck", sql`${t.mood} is null or ${t.mood} between 1 and 5`),
    check("journal_entries_energy_ck", sql`${t.energy} is null or ${t.energy} between 1 and 5`),
  ],
);

/** CRM contacts. `last_contacted_at` is derived/cached from interactions by the service layer. */
export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    name: text("name").notNull(),
    nickname: text("nickname"),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    jobTitle: text("job_title"),
    relationship: text("relationship", { enum: CONTACT_RELATIONSHIP }).notNull().default("other"),
    /** Birthday as `YYYY-MM-DD`; use `0000` year when unknown. */
    birthday: dateColumn("birthday"),
    notes: text("notes"),
    /** Desired keep-in-touch cadence in days (null = no reminder). */
    contactFrequencyDays: integer("contact_frequency_days"),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("contacts_name_idx").on(t.name),
    enumCheck("contacts_relationship_ck", t.relationship, CONTACT_RELATIONSHIP),
    isoDateCheck("contacts_birthday_ck", t.birthday),
    check(
      "contacts_frequency_ck",
      sql`${t.contactFrequencyDays} is null or ${t.contactFrequencyDays} > 0`,
    ),
  ],
);

export const contactInteractions = sqliteTable(
  "contact_interactions",
  {
    id: id(),
    contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type", { enum: INTERACTION_TYPE }).notNull().default("other"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(NOW_MS),
    summary: text("summary").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("contact_interactions_contact_idx").on(t.contactId, t.occurredAt),
    enumCheck("contact_interactions_type_ck", t.type, INTERACTION_TYPE),
  ],
);
