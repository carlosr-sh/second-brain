/** Date → ISO string (nullable passthrough) for DTO mapping. */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoRequired = (d: Date): string => d.toISOString();

/** SQL status groups, kept in one place. */
export const OPEN_TASK_STATUSES = "('todo','in_progress','waiting')";
export const ACTIVE_PROJECT_STATUSES = "('planned','active','on_hold')";
