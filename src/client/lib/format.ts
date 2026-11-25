import { APP_TIMEZONE } from "@shared/constants";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  dateStyle: "short",
  timeStyle: "medium",
});

/** Stored timestamps are UTC; presentation is always America/Recife. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
