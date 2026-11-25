import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { BACKUP_KIND, BACKUP_STATUS, VIEW_LAYOUT } from "../../../shared/enums";
import { NOW_MS, enumCheck, id, timestamps } from "./_helpers";

/** Saved filters / views per module (e.g. "Tasks due this week" as a board). */
export const savedViews = sqliteTable(
  "saved_views",
  {
    id: id(),
    module: text("module").notNull(),
    name: text("name").notNull(),
    layout: text("layout", { enum: VIEW_LAYOUT }).notNull().default("list"),
    filters: text("filters", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    sort: text("sort", { mode: "json" }).$type<Record<string, unknown>>(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("saved_views_module_idx").on(t.module), enumCheck("saved_views_layout_ck", t.layout, VIEW_LAYOUT)],
);

/** Key/value user preferences (theme, sidebar state, defaults...). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(NOW_MS)
    .$onUpdateFn(() => new Date()),
});

/**
 * Append-only audit trail of sensitive operations. Intentionally has NO
 * foreign keys: entries must survive deletion of the entities they describe.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(NOW_MS),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [
    index("audit_logs_occurred_idx").on(t.occurredAt),
    index("audit_logs_action_idx").on(t.action, t.occurredAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Log of backup / export / restore / integrity-check runs. */
export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: id(),
    kind: text("kind", { enum: BACKUP_KIND }).notNull(),
    status: text("status", { enum: BACKUP_STATUS }).notNull().default("running"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().default(NOW_MS),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    location: text("location"),
    sizeBytes: integer("size_bytes"),
    itemCount: integer("item_count"),
    checksum: text("checksum"),
    error: text("error"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [
    index("backup_runs_kind_started_idx").on(t.kind, t.startedAt),
    enumCheck("backup_runs_kind_ck", t.kind, BACKUP_KIND),
    enumCheck("backup_runs_status_ck", t.status, BACKUP_STATUS),
  ],
);
