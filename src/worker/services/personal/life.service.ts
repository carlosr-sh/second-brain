import { addDays, parseIsoDate } from "../../../shared/dates";
import { completionRate, currentStreak, longestStreak, periodStart, type HabitFrequency } from "../../../shared/habits";
import type {
  Contact, ContactDetail, CreateContactInput, CreateHabitInput, Habit, Interaction, JournalEntry, JournalSummary, UpdateContactInput, UpdateHabitInput, UpsertJournalInput,
} from "../../../shared/personal";
import { emptyDoc, extractText, type RichDoc } from "../../../shared/rich-text";
import { assertLive, conflict, notFound } from "../../lib/errors";
import type { AreaRepository } from "../../repositories/area.repository";
import type { GoalRepository } from "../../repositories/goal.repository";
import type { ContactRepository, ContactRow } from "../../repositories/personal/contact.repository";
import type { HabitRepository, HabitRow } from "../../repositories/personal/habit.repository";
import type { JournalRepository, JournalRow } from "../../repositories/personal/journal.repository";
import { iso, isoRequired } from "../../repositories/_shared";

const archiveValue = (current: { archivedAt: Date | null }, archived: boolean | undefined) =>
  archived === undefined ? {} : { archivedAt: archived ? (current.archivedAt ?? new Date()) : null };

async function restoreRow(repo: { findById(id: string): Promise<{ deletedAt: Date | null } | undefined>; update(id: string, v: { deletedAt: null }): Promise<void> }, id: string, label: string) {
  const row = await repo.findById(id);
  if (!row) throw notFound(`${label} não encontrado(a)`);
  if (!row.deletedAt) throw conflict(`${label} não está na lixeira`);
  await repo.update(id, { deletedAt: null });
}

/* ---------------- habits ---------------- */
const HEATMAP_DAYS = 26 * 7;

export class HabitService {
  constructor(private readonly repo: HabitRepository, private readonly areas: AreaRepository, private readonly goals: GoalRepository, private readonly today: () => string) {}

  async list(archived: boolean): Promise<Habit[]> {
    const rows = await this.repo.list(archived);
    return this.withStats(rows);
  }

  private async withStats(rows: HabitRow[]): Promise<Habit[]> {
    const today = this.today();
    // Enough history for streaks: heatmap window or more for monthly habits.
    const from = addDays(today, -400);
    const logs = await this.repo.logsSince(rows.map((r) => r.id), from);
    return rows.map((h) => {
      const own = logs.filter((l) => l.habitId === h.id).map((l) => ({ date: l.date, count: l.count }));
      const freq = h.frequency as HabitFrequency;
      const current = periodStart(today, freq);
      return {
        id: h.id, name: h.name, description: h.description, frequency: h.frequency, targetCount: h.targetCount, color: h.color,
        areaId: h.areaId, goalId: h.goalId, archivedAt: iso(h.archivedAt),
        logs: own.filter((l) => l.date >= addDays(today, -HEATMAP_DAYS)),
        stats: {
          currentStreak: currentStreak(own, freq, h.targetCount, today),
          longestStreak: longestStreak(own, freq, h.targetCount),
          completionRate: completionRate(own, freq, h.targetCount, today),
          currentPeriodCount: own.filter((l) => periodStart(l.date, freq) === current).reduce((s, l) => s + l.count, 0),
        },
      };
    });
  }

  async get(id: string): Promise<Habit> {
    const [habit] = await this.withStats([assertLive(await this.repo.findById(id), "Hábito")]);
    return habit as Habit;
  }

  private async checkRefs(input: { areaId?: string | null; goalId?: string | null }) {
    if (input.areaId) assertLive(await this.areas.findById(input.areaId), "Área");
    if (input.goalId) assertLive(await this.goals.findById(input.goalId), "Meta");
  }
  async create(input: CreateHabitInput) {
    await this.checkRefs(input);
    return this.get((await this.repo.insert({ ...input, startedOn: this.today() })).id);
  }
  async update(id: string, input: UpdateHabitInput) {
    const current = assertLive(await this.repo.findById(id), "Hábito");
    await this.checkRefs(input);
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.get(id);
  }
  /** Check-in: sets the day's count (0 clears). Future days are rejected. */
  async log(id: string, date: string, count: number, note: string | null | undefined) {
    assertLive(await this.repo.findById(id), "Hábito");
    if (date > this.today()) throw conflict("Não é possível registrar dias futuros");
    await this.repo.setLog(id, date, count, note ?? null);
    return this.get(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Hábito");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Hábito");
    return this.get(id);
  }
}

/* ---------------- journal ---------------- */
export class JournalService {
  constructor(private readonly repo: JournalRepository) {}

  async list(from: string, to: string): Promise<JournalSummary[]> {
    return (await this.repo.list(from, to)).map((r) => ({ id: r.id, date: r.date, title: r.title, excerpt: r.excerpt, mood: r.mood, energy: r.energy }));
  }

  async get(date: string): Promise<JournalEntry> {
    const row = await this.repo.findByDate(date);
    if (!row) throw notFound("Sem registro neste dia");
    return toJournalDto(row);
  }

  /** One live entry per day: creates it on first save, updates afterwards. */
  async upsert(date: string, input: UpsertJournalInput): Promise<JournalEntry> {
    const { content, ...fields } = input;
    const derived = content ? { contentJson: content, contentText: extractText(content) } : {};
    const current = await this.repo.findByDate(date);
    if (current) await this.repo.update(current.id, { ...fields, ...derived });
    else await this.repo.insert({ entryDate: date, ...fields, ...derived }); // partial UNIQUE index guards races (→ 409)
    return this.get(date);
  }

  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Registro");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw notFound("Registro não encontrado");
    if (!row.deletedAt) throw conflict("O registro não está na lixeira");
    if (await this.repo.findByDate(row.entryDate)) throw conflict("Já existe um registro neste dia");
    await this.repo.update(id, { deletedAt: null });
    return this.get(row.entryDate);
  }
}

function toJournalDto(r: JournalRow): JournalEntry {
  return {
    id: r.id, date: r.entryDate, title: r.title, excerpt: r.contentText.slice(0, 200), mood: r.mood, energy: r.energy,
    content: (r.contentJson as RichDoc | null) ?? emptyDoc(), updatedAt: isoRequired(r.updatedAt),
  };
}

/* ---------------- contacts ---------------- */
/** Next occurrence of a birthday (year 0000 = unknown) on or after `today`; Feb 29 → Feb 28 in common years. */
export function nextBirthday(birthday: string, today: string): { date: string; days: number } {
  const md = birthday.slice(5);
  const at = (year: number) => {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return `${year}-${md === "02-29" && !leap ? "02-28" : md}`;
  };
  const year = Number(today.slice(0, 4));
  const date = at(year) >= today ? at(year) : at(year + 1);
  const days = Math.round((parseIsoDate(date).getTime() - parseIsoDate(today).getTime()) / 86_400_000);
  return { date, days };
}

export class ContactService {
  constructor(private readonly repo: ContactRepository, private readonly today: () => string) {}

  private dto(r: ContactRow, lastMs: number | null): Contact {
    const today = this.today();
    const last = lastMs ? new Date(lastMs) : null;
    const since = r.contactFrequencyDays ? (last ? Math.floor((Date.parse(`${today}T12:00:00Z`) - last.getTime()) / 86_400_000) : Infinity) : null;
    const nb = r.birthday ? nextBirthday(r.birthday, today) : null;
    return {
      id: r.id, name: r.name, nickname: r.nickname, email: r.email, phone: r.phone, company: r.company, jobTitle: r.jobTitle,
      relationship: r.relationship, birthday: r.birthday, notes: r.notes, contactFrequencyDays: r.contactFrequencyDays,
      lastContactedAt: iso(last), due: since !== null && r.contactFrequencyDays !== null && since >= r.contactFrequencyDays,
      nextBirthday: nb?.date ?? null, daysToBirthday: nb?.days ?? null, archivedAt: iso(r.archivedAt),
    };
  }

  async list(archived: boolean): Promise<Contact[]> {
    return (await this.repo.list(archived)).map((r) => this.dto(r.contact, r.lastContactedAt));
  }

  async get(id: string): Promise<ContactDetail> {
    const row = await this.repo.findWithLast(id);
    if (!row || row.contact.deletedAt) throw notFound("Contato não encontrado");
    const interactions: Interaction[] = (await this.repo.interactions(id)).map((i) => ({ id: i.id, type: i.type, occurredAt: isoRequired(i.occurredAt), summary: i.summary }));
    return { ...this.dto(row.contact, row.lastContactedAt), interactions };
  }

  async create(input: CreateContactInput) {
    return this.get((await this.repo.insert(input)).id);
  }
  async update(id: string, input: UpdateContactInput) {
    const current = assertLive(await this.repo.findById(id), "Contato");
    const { archived, ...values } = input;
    await this.repo.update(id, { ...values, ...archiveValue(current, archived) });
    return this.get(id);
  }
  async addInteraction(id: string, input: { type?: Interaction["type"]; occurredAt?: string; summary: string }) {
    assertLive(await this.repo.findById(id), "Contato");
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (occurredAt.getTime() > Date.now() + 60_000) throw conflict("A interação não pode estar no futuro");
    await this.repo.addInteraction({ contactId: id, type: input.type ?? "other", occurredAt, summary: input.summary });
    return this.get(id);
  }
  async deleteInteraction(id: string, interactionId: string) {
    assertLive(await this.repo.findById(id), "Contato");
    if (!(await this.repo.deleteInteraction(id, interactionId))) throw notFound("Interação não encontrada");
    return this.get(id);
  }
  async trash(id: string) {
    assertLive(await this.repo.findById(id), "Contato");
    await this.repo.update(id, { deletedAt: new Date() });
  }
  async restore(id: string) {
    await restoreRow(this.repo, id, "Contato");
    return this.get(id);
  }
}
