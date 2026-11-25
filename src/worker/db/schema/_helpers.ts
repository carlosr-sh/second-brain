import { sql, type SQL } from "drizzle-orm";
import { check, integer, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { uuidv7 } from "../../../shared/uuid";

/**
 * SQL expression for "now" as integer Unix milliseconds (UTC).
 * Used as a DB-level default so raw SQL inserts (e.g. restores) stay valid.
 */
export const NOW_MS = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

/** UUIDv7 primary key stored as TEXT. */
export const id = () => text("id").primaryKey().$defaultFn(() => uuidv7());

/** Mandatory audit timestamps, UTC Unix ms. */
export const timestamps = () => ({
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(NOW_MS),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(NOW_MS)
    .$onUpdateFn(() => new Date()),
});

/** Soft deletion marker: row goes to the trash instead of being removed. */
export const softDelete = () => ({
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

/** PARA "Archive": inactive but kept and searchable. */
export const archivable = () => ({
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

/** Calendar date column (`YYYY-MM-DD`, interpreted in America/Recife). */
export const dateColumn = (name: string) => text(name);

/** CHECK that a TEXT column only holds one of the allowed enum values. */
export function enumCheck(
  name: string,
  column: AnySQLiteColumn,
  values: readonly string[],
  nullable = false,
) {
  const list = sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", "));
  const expr: SQL = nullable
    ? sql`${column} is null or ${column} in (${list})`
    : sql`${column} in (${list})`;
  return check(name, expr);
}

/** CHECK that a TEXT column is null or looks like `YYYY-MM-DD`. */
export function isoDateCheck(name: string, column: AnySQLiteColumn) {
  return check(
    name,
    sql`${column} is null or (length(${column}) = 10 and ${column} glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')`,
  );
}

/** CHECK that at most one of the given columns is non-null. */
export function atMostOneCheck(name: string, columns: AnySQLiteColumn[]) {
  const parts = columns.map((c) => sql`(${c} is not null)`);
  return check(name, sql`(${sql.join(parts, sql` + `)}) <= 1`);
}
