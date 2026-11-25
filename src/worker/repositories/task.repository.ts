import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { TaskListQuery } from "../../shared/para";
import type { Database } from "../db/client";
import { inboxItems, projects, tasks } from "../db/schema";

export type TaskRow = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
/** Propagation of an update to a task's subtasks (optionally only those matching a state). */
export interface ChildOp {
  set: Partial<NewTask>;
  onlyWhere?: { field: "archivedAt" | "deletedAt"; equals: Date | null };
}

export class TaskRepository {
  constructor(private readonly db: Database) {}

  list(q: TaskListQuery, limit = 1000): Promise<TaskRow[]> {
    const where: SQL[] = [isNull(tasks.deletedAt), q.archived === "true" ? isNotNull(tasks.archivedAt) : isNull(tasks.archivedAt)];
    if (q.projectId) where.push(eq(tasks.projectId, q.projectId));
    if (q.areaId) {
      const inArea = or(
        eq(tasks.areaId, q.areaId),
        inArray(tasks.projectId, this.db.select({ id: projects.id }).from(projects).where(eq(projects.areaId, q.areaId))),
      );
      if (inArea) where.push(inArea);
    }
    if (q.status?.length) where.push(inArray(tasks.status, q.status));
    if (q.dueFrom) where.push(gte(tasks.dueDate, q.dueFrom));
    if (q.dueTo) where.push(lte(tasks.dueDate, q.dueTo));
    if (q.parentTaskId) where.push(eq(tasks.parentTaskId, q.parentTaskId));
    if (q.unassigned) where.push(isNull(tasks.projectId), isNull(tasks.areaId));
    return this.db.select().from(tasks).where(and(...where)).orderBy(asc(tasks.position), asc(tasks.createdAt)).limit(limit);
  }

  async findById(id: string): Promise<TaskRow | undefined> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  }

  async countChildren(id: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.parentTaskId, id), isNull(tasks.deletedAt)));
    return row?.n ?? 0;
  }

  async nextPosition(): Promise<number> {
    const [row] = await this.db.select({ max: sql<number | null>`max(${tasks.position})` }).from(tasks);
    return (row?.max ?? 0) + 1;
  }

  async insert(values: NewTask): Promise<TaskRow> {
    const [row] = await this.db.insert(tasks).values(values).returning();
    if (!row) throw new Error("task insert returned no row");
    return row;
  }

  /** Atomic: create the task from an inbox item and mark the item processed. */
  async insertFromInbox(values: NewTask, inboxId: string): Promise<TaskRow> {
    const [inserted] = await this.db.batch([
      this.db.insert(tasks).values(values).returning(),
      this.db.update(inboxItems).set({ processedAt: new Date() }).where(eq(inboxItems.id, inboxId)),
    ]);
    const row = inserted[0];
    if (!row) throw new Error("task insert returned no row");
    return row;
  }

  /**
   * Atomic multi-step update:
   *  - the task itself
   *  - optional propagation to subtasks (location or archive/delete state)
   *  - optional insert of the next occurrence of a recurring task
   */
  async updateAtomic(
    id: string,
    values: Partial<NewTask>,
    opts: {
      children?: ChildOp[];
      spawn?: NewTask;
    } = {},
  ): Promise<TaskRow | null> {
    const ops = [this.db.update(tasks).set(values).where(eq(tasks.id, id))] as const;
    const extra = [];
    for (const child of opts.children ?? []) {
      const where: SQL[] = [eq(tasks.parentTaskId, id)];
      const only = child.onlyWhere;
      if (only) where.push(only.equals ? eq(tasks[only.field], only.equals) : isNull(tasks[only.field]));
      extra.push(this.db.update(tasks).set(child.set).where(and(...where)));
    }
    if (opts.spawn) {
      const results = await this.db.batch([...ops, ...extra, this.db.insert(tasks).values(opts.spawn).returning()]);
      const spawned = (results[results.length - 1] as TaskRow[])[0];
      return spawned ?? null;
    }
    if (extra.length) await this.db.batch([...ops, ...extra]);
    else await ops[0];
    return null;
  }

  async purge(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id)); // subtasks cascade via FK
  }
}
