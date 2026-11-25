import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, softDelete, timestamps } from "./_helpers";

/**
 * Metadata for every object stored in R2. The R2 object key is derived from
 * the row id, never from the user-supplied filename (prevents path tricks).
 * `sha256` enables integrity checks and de-duplicated backups.
 */
export const files = sqliteTable(
  "files",
  {
    id: id(),
    r2Key: text("r2_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("files_r2_key_uq").on(t.r2Key),
    index("files_sha256_idx").on(t.sha256),
    check("files_size_ck", sql`${t.sizeBytes} >= 0`),
  ],
);
