import { APP_TIMEZONE } from "@shared/constants";

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, dateStyle: "short", timeStyle: "short" });
const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** Stored timestamps are UTC; presentation is always America/Recife. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatLongDate = (d: Date) => longDate.format(d);

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "agora";
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diffSec / 3600), "hour");
  if (abs < 7 * 86_400) return relative.format(Math.round(diffSec / 86_400), "day");
  return formatDateTime(iso);
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" });
const shortDateYear = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const weekdayName = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" });

/**
 * Human label for a calendar date relative to `today` (both `YYYY-MM-DD`, Recife).
 * Calendar dates are formatted in UTC on purpose: they are dates, not instants.
 */
export function formatDueDate(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const diff = Math.round((d.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff > 1 && diff < 7) return weekdayName.format(d).replace(/^./, (c) => c.toUpperCase());
  return (date.slice(0, 4) === today.slice(0, 4) ? shortDate : shortDateYear).format(d).replace(".", "");
}
