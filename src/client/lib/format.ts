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
