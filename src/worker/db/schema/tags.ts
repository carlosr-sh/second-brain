import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "./_helpers";

/** Cross-cutting labels. Linked to entities via explicit junction tables. */
export const tags = sqliteTable(
  "tags",
  {
    id: id(),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("tags_name_nocase_uq").on(sql`${t.name} collate nocase`)],
);
