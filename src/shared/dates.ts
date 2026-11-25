import { z } from "./z";
import { ISO_DATE_REGEX } from "./constants";

/** Pure calendar-date arithmetic on `YYYY-MM-DD` strings (no timezone involved). */
export function parseIsoDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const date = parseIsoDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return formatIsoDate(date);
}

/** Adds months, clamping to the last day of the target month (Jan 31 + 1 → Feb 28/29). */
export function addMonths(d: string, n: number): string {
  const date = parseIsoDate(d);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return formatIsoDate(date);
}

/** 0 = Monday … 6 = Sunday (ISO weekday order). */
export function isoWeekday(d: string): number {
  return (parseIsoDate(d).getUTCDay() + 6) % 7;
}

export function isValidIsoDate(d: string): boolean {
  return ISO_DATE_REGEX.test(d) && formatIsoDate(parseIsoDate(d)) === d;
}

/** Zod: a real calendar date (rejects 2026-02-30). */
export const isoDateSchema = z.string().refine(isValidIsoDate, "Data inválida (use AAAA-MM-DD)");
