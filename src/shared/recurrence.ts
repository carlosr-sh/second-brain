import { z } from "zod";
import { addDays, addMonths, isoWeekday, parseIsoDate } from "./dates";

/**
 * Recurrence rules: a small, explicit subset of iCalendar RRULE (RFC 5545).
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY [;INTERVAL=n] [;BYDAY=MO,TU,...]  (BYDAY only with WEEKLY)
 */
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceRule {
  freq: Frequency;
  interval: number;
  byDay: Weekday[];
}

export function parseRule(text: string): RecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const seg of text.trim().toUpperCase().split(";")) {
    const [k, v] = seg.split("=");
    if (!k || !v || parts.has(k)) return null;
    parts.set(k, v);
  }
  for (const k of parts.keys()) if (!["FREQ", "INTERVAL", "BYDAY"].includes(k)) return null;

  const freq = parts.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;

  const intervalText = parts.get("INTERVAL") ?? "1";
  if (!/^\d{1,3}$/.test(intervalText)) return null;
  const interval = Number(intervalText);
  if (interval < 1 || interval > 365) return null;

  let byDay: Weekday[] = [];
  const byDayText = parts.get("BYDAY");
  if (byDayText !== undefined) {
    if (freq !== "WEEKLY") return null;
    const days = byDayText.split(",");
    if (!days.every((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d))) return null;
    byDay = WEEKDAYS.filter((d) => days.includes(d)); // canonical order, no duplicates
  }
  return { freq, interval, byDay };
}

export function serializeRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay.length) parts.push(`BYDAY=${rule.byDay.join(",")}`);
  return parts.join(";");
}

/** First occurrence strictly after `from` (`YYYY-MM-DD`). */
export function nextOccurrence(from: string, rule: RecurrenceRule): string {
  switch (rule.freq) {
    case "DAILY":
      return addDays(from, rule.interval);
    case "MONTHLY":
      return addMonths(from, rule.interval);
    case "YEARLY":
      return addMonths(from, 12 * rule.interval);
    case "WEEKLY": {
      if (!rule.byDay.length) return addDays(from, 7 * rule.interval);
      const wanted = new Set(rule.byDay.map((d) => WEEKDAYS.indexOf(d)));
      const weekStart = (d: string) => addDays(d, -isoWeekday(d));
      const fromWeek = parseIsoDate(weekStart(from)).getTime();
      for (let i = 1; i <= 7 * rule.interval + 7; i++) {
        const candidate = addDays(from, i);
        const weeks = Math.round((parseIsoDate(weekStart(candidate)).getTime() - fromWeek) / (7 * 86_400_000));
        if (wanted.has(isoWeekday(candidate)) && weeks % rule.interval === 0) return candidate;
      }
      throw new Error("unreachable: weekly rule without a match");
    }
  }
}

export const recurrenceRuleSchema = z
  .string()
  .max(100)
  .refine((v) => parseRule(v) !== null, "Regra de recorrência inválida")
  .transform((v) => serializeRule(parseRule(v) as RecurrenceRule));

/** Presets offered by the UI. */
export const RECURRENCE_PRESETS = [
  { value: "FREQ=DAILY", label: "Todo dia" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Dias úteis" },
  { value: "FREQ=WEEKLY", label: "Toda semana" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "A cada 2 semanas" },
  { value: "FREQ=MONTHLY", label: "Todo mês" },
  { value: "FREQ=YEARLY", label: "Todo ano" },
] as const;

export function describeRule(text: string | null): string | null {
  if (!text) return null;
  const preset = RECURRENCE_PRESETS.find((p) => p.value === text);
  if (preset) return preset.label;
  const rule = parseRule(text);
  if (!rule) return null;
  const unit = { DAILY: "dia(s)", WEEKLY: "semana(s)", MONTHLY: "mês(es)", YEARLY: "ano(s)" }[rule.freq];
  return `A cada ${rule.interval} ${unit}${rule.byDay.length ? ` (${rule.byDay.join(", ")})` : ""}`;
}
