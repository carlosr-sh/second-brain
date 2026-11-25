import { addDays, addMonths, isoWeekday } from "./dates";

export type HabitFrequency = "daily" | "weekly" | "monthly";
export interface HabitLogPoint {
  date: string; // YYYY-MM-DD (local calendar date)
  count: number;
}

/** Period a date belongs to: the day, the ISO week (its Monday) or the month (YYYY-MM-01). */
export function periodStart(date: string, freq: HabitFrequency): string {
  if (freq === "daily") return date;
  if (freq === "weekly") return addDays(date, -isoWeekday(date));
  return `${date.slice(0, 7)}-01`;
}

const previousPeriod = (start: string, freq: HabitFrequency) =>
  freq === "daily" ? addDays(start, -1) : freq === "weekly" ? addDays(start, -7) : addMonths(start, -1);

export function periodTotals(logs: HabitLogPoint[], freq: HabitFrequency): Map<string, number> {
  const totals = new Map<string, number>();
  for (const l of logs) {
    const k = periodStart(l.date, freq);
    totals.set(k, (totals.get(k) ?? 0) + l.count);
  }
  return totals;
}

/**
 * Consecutive periods meeting the target, ending at the current period.
 * The CURRENT period not being done yet does not break the streak
 * (you still have today / this week to do it).
 */
export function currentStreak(logs: HabitLogPoint[], freq: HabitFrequency, target: number, today: string): number {
  const totals = periodTotals(logs, freq);
  let p = periodStart(today, freq);
  if ((totals.get(p) ?? 0) < target) p = previousPeriod(p, freq);
  let streak = 0;
  while ((totals.get(p) ?? 0) >= target) {
    streak++;
    p = previousPeriod(p, freq);
  }
  return streak;
}

export function longestStreak(logs: HabitLogPoint[], freq: HabitFrequency, target: number): number {
  const met = [...periodTotals(logs, freq)].filter(([, n]) => n >= target).map(([k]) => k).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of met) {
    run = prev !== null && previousPeriod(k, freq) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Share of the last N periods (incl. current) meeting the target: 30 days / 12 weeks / 6 months. */
export function completionRate(logs: HabitLogPoint[], freq: HabitFrequency, target: number, today: string): number {
  const n = freq === "daily" ? 30 : freq === "weekly" ? 12 : 6;
  const totals = periodTotals(logs, freq);
  let p = periodStart(today, freq);
  let met = 0;
  for (let i = 0; i < n; i++) {
    if ((totals.get(p) ?? 0) >= target) met++;
    p = previousPeriod(p, freq);
  }
  return met / n;
}
