import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { GOAL_HORIZON, GOAL_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS } from "../../../shared/enums";
import {
  archivable,
  atMostOneCheck,
  dateColumn,
  enumCheck,
  id,
  isoDateCheck,
  softDelete,
  timestamps,
} from "./_helpers";
import { tags } from "./tags";

/** PARA — Areas: ongoing spheres of responsibility with no end date. */
export const areas = sqliteTable(
  "areas",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    position: real("position").notNull().default(0),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [index("areas_position_idx").on(t.position)],
);

/** Goals: desired outcomes, optionally inside an Area. Projects serve goals. */
export const goals = sqliteTable(
  "goals",
  {
    id: id(),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: GOAL_STATUS }).notNull().default("not_started"),
    horizon: text("horizon", { enum: GOAL_HORIZON }).notNull().default("quarter"),
    targetDate: dateColumn("target_date"),
    achievedAt: integer("achieved_at", { mode: "timestamp_ms" }),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("goals_area_idx").on(t.areaId),
    index("goals_status_idx").on(t.status),
    enumCheck("goals_status_ck", t.status, GOAL_STATUS),
    enumCheck("goals_horizon_ck", t.horizon, GOAL_HORIZON),
    isoDateCheck("goals_target_date_ck", t.targetDate),
  ],
);

/** PARA — Projects: short-term efforts with a goal and (ideally) a deadline. */
export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: PROJECT_STATUS }).notNull().default("planned"),
    priority: text("priority", { enum: PRIORITY }).notNull().default("none"),
    startDate: dateColumn("start_date"),
    dueDate: dateColumn("due_date"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    position: real("position").notNull().default(0),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("projects_area_idx").on(t.areaId),
    index("projects_goal_idx").on(t.goalId),
    index("projects_status_idx").on(t.status, t.position),
    index("projects_due_idx").on(t.dueDate),
    enumCheck("projects_status_ck", t.status, PROJECT_STATUS),
    enumCheck("projects_priority_ck", t.priority, PRIORITY),
    isoDateCheck("projects_start_date_ck", t.startDate),
    isoDateCheck("projects_due_date_ck", t.dueDate),
  ],
);

/**
 * Tasks. PARA location rule: a task belongs to a Project OR directly to an
 * Area OR to neither (loose task) — never both (area is derived via project).
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    parentTaskId: text("parent_task_id").references((): AnySQLiteColumn => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status", { enum: TASK_STATUS }).notNull().default("todo"),
    priority: text("priority", { enum: PRIORITY }).notNull().default("none"),
    dueDate: dateColumn("due_date"),
    scheduledDate: dateColumn("scheduled_date"),
    /** iCalendar RRULE subset, e.g. `FREQ=WEEKLY;BYDAY=MO`. Null = not recurring. */
    recurrenceRule: text("recurrence_rule"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    position: real("position").notNull().default(0),
    ...archivable(),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_area_idx").on(t.areaId),
    index("tasks_parent_idx").on(t.parentTaskId),
    index("tasks_status_position_idx").on(t.status, t.position),
    index("tasks_due_idx").on(t.dueDate),
    index("tasks_scheduled_idx").on(t.scheduledDate),
    enumCheck("tasks_status_ck", t.status, TASK_STATUS),
    enumCheck("tasks_priority_ck", t.priority, PRIORITY),
    isoDateCheck("tasks_due_date_ck", t.dueDate),
    isoDateCheck("tasks_scheduled_date_ck", t.scheduledDate),
    atMostOneCheck("tasks_single_location_ck", [t.projectId, t.areaId]),
    check("tasks_not_own_parent_ck", sql`${t.parentTaskId} is null or ${t.parentTaskId} <> ${t.id}`),
  ],
);

export const projectTags = sqliteTable(
  "project_tags",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.tagId] }), index("project_tags_tag_idx").on(t.tagId)],
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] }), index("task_tags_tag_idx").on(t.tagId)],
);

/**
 * Inbox: raw quick-capture items awaiting triage. Once processed into a
 * task/note/bookmark the item is marked `processed_at` (and later purged).
 */
export const inboxItems = sqliteTable(
  "inbox_items",
  {
    id: id(),
    content: text("content").notNull(),
    url: text("url"),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => [index("inbox_items_processed_idx").on(t.processedAt, t.createdAt)],
);
