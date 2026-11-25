import { APP_TIMEZONE } from "./constants";

/** Calendar date (`YYYY-MM-DD`) of an instant in the given timezone. */
export function isoDateIn(date: Date, timeZone: string = APP_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Hour of day (0–23) of an instant in the given timezone. */
export function hourIn(date: Date, timeZone: string = APP_TIMEZONE): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(h);
}

export function greetingFor(date: Date, timeZone: string = APP_TIMEZONE): string {
  const h = hourIn(date, timeZone);
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
