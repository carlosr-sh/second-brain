import { and, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { ProjectStatus } from "../../shared/enums";
import type { Database } from "../db/client";
import { projects, tasks } from "../db/schema";
import { OPEN_TASK_STATUSES } from "./_shared";

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectWithStats = ProjectRow & { openTasks: number; doneTasks: number };

export interface ProjectFilter {
  archived: boolean;
  areaId?: string;
  goalId?: string;
  status?: ProjectStatus[];
}

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  private select() {
    const p = projects;
    return this.db
      .select({
        id: p.id, areaId: p.areaId, goalId: p.goalId, name: p.name, description: p.description, status: p.status,
        priority: p.priority, startDate: p.startDate, dueDate: p.dueDate, completedAt: p.completedAt,
        position: p.position, archivedAt: p.archivedAt, deletedAt: p.deletedAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
        openTasks: sql<number>`(select count(*) from tasks t where t.project_id = ${sql.raw("projects.id")} and t.parent_task_id is null
          and t.deleted_at is null and t.status in ${sql.raw(OPEN_TASK_STATUSES)})`,
        doneTasks: sql<number>`(select count(*) from tasks t where t.project_id = ${sql.raw("projects.id")} and t.parent_task_id is null
          and t.deleted_at is null and t.status = 'done')`,
      })
      .from(p);
  }

  list(filter: ProjectFilter): Promise<ProjectWithStats[]> {
    const where: SQL[] = [isNull(projects.deletedAt), filter.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)];
    if (filter.areaId) where.push(eq(projects.areaId, filter.areaId));
    if (filter.goalId) where.push(eq(projects.goalId, filter.goalId));
    if (filter.status?.length) where.push(inArray(projects.status, filter.status));
    return this.select().where(and(...where)).orderBy(asc(projects.position), asc(projects.createdAt));
  }

  async findWithStats(id: string): Promise<ProjectWithStats | undefined> {
    const [row] = await this.select().where(eq(projects.id, id));
    return row;
  }

  async findById(id: string): Promise<ProjectRow | undefined> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, id));
    return row;
  }

  async nextPosition(): Promise<number> {
    const [row] = await this.db.select({ max: sql<number | null>`max(${projects.position})` }).from(projects);
    return (row?.max ?? 0) + 1;
  }

  async insert(values: typeof projects.$inferInsert): Promise<ProjectRow> {
    const [row] = await this.db.insert(projects).values(values).returning();
    if (!row) throw new Error("project insert returned no row");
    return row;
  }

  /**
   * Updates the project and cascades archive/delete state to its tasks
   * atomically. Cascade uses the SAME timestamp so a later restore brings
   * back exactly the tasks that left together with the project.
   */
  async updateWithCascade(
    id: string,
    values: Partial<typeof projects.$inferInsert>,
    cascade?: { field: "archivedAt" | "deletedAt"; to: Date | null; from: Date | null },
  ): Promise<void> {
    const projectUpdate = this.db.update(projects).set(values).where(eq(projects.id, id));
    if (!cascade) {
      await projectUpdate;
      return;
    }
    const col = tasks[cascade.field];
    const taskUpdate = this.db
      .update(tasks)
      .set({ [cascade.field]: cascade.to })
      .where(and(eq(tasks.projectId, id), cascade.to ? isNull(col) : cascade.from ? eq(col, cascade.from) : sql`0`));
    await this.db.batch([projectUpdate, taskUpdate]);
  }

  async purge(id: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id)); // tasks cascade via FK
  }
}
