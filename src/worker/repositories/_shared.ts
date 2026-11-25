/** Date → ISO string (nullable passthrough) for DTO mapping. */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoRequired = (d: Date): string => d.toISOString();

/** SQL status groups, kept in one place. */
export const OPEN_TASK_STATUSES = "('todo','in_progress','waiting')";
export const ACTIVE_PROJECT_STATUSES = "('planned','active','on_hold')";

/** D1 allows at most 100 bound parameters per query: split id lists. */
export function chunk<T>(items: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
