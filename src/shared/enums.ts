/**
 * Domain enumerations. Single source of truth for:
 *  - Drizzle column types + DB CHECK constraints (backend)
 *  - Zod validation (API)
 *  - UI selects/labels (frontend)
 */
export const PROJECT_STATUS = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const TASK_STATUS = ["todo", "in_progress", "waiting", "done", "cancelled"] as const;
export const GOAL_STATUS = ["not_started", "in_progress", "achieved", "abandoned"] as const;
export const GOAL_HORIZON = ["week", "month", "quarter", "year", "long_term"] as const;
export const PRIORITY = ["none", "low", "medium", "high", "urgent"] as const;

export const HABIT_FREQUENCY = ["daily", "weekly", "monthly"] as const;

export const BOOK_STATUS = ["want_to_read", "reading", "finished", "abandoned"] as const;

export const ACCOUNT_TYPE = ["checking", "savings", "credit_card", "cash", "investment", "other"] as const;
export const CATEGORY_KIND = ["income", "expense"] as const;
export const TRANSACTION_KIND = ["income", "expense", "transfer", "adjustment"] as const;
export const TRANSACTION_STATUS = ["pending", "cleared"] as const;

export const CONTACT_RELATIONSHIP = ["family", "friend", "colleague", "client", "mentor", "acquaintance", "other"] as const;
export const INTERACTION_TYPE = ["call", "meeting", "message", "email", "event", "other"] as const;

export const VIEW_LAYOUT = ["list", "table", "board", "calendar", "gallery"] as const;
export const BACKUP_KIND = ["json_export", "markdown_export", "r2_mirror", "d1_time_travel_bookmark", "restore", "integrity_check"] as const;
export const BACKUP_STATUS = ["running", "succeeded", "failed"] as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];
export type Priority = (typeof PRIORITY)[number];
