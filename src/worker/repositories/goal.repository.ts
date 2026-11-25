import { and, asc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "../db/client";
import { goals } from "../db/schema";

export type GoalRow = typeof goals.$inferSelect;
export type GoalWithProgress = GoalRow & { completedProjects: number; totalProjects: number };

export class GoalRepository {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select({
        ...this.columns(),
        completedProjects: sql<number>`(select count(*) from projects p where p.goal_id = ${sql.raw("goals.id")}
          and p.deleted_at is null and p.status = 'completed')`,
        totalProjects: sql<number>`(select count(*) from projects p where p.goal_id = ${sql.raw("goals.id")}
          and p.deleted_at is null and p.status <> 'cancelled')`,
      })
      .from(goals);
  }

  private columns() {
    const g = goals;
    return {
      id: g.id, areaId: g.areaId, title: g.title, description: g.description, status: g.status, horizon: g.horizon,
      targetDate: g.targetDate, achievedAt: g.achievedAt, archivedAt: g.archivedAt, deletedAt: g.deletedAt,
      createdAt: g.createdAt, updatedAt: g.updatedAt,
    };
  }

  list(filter: { archived: boolean; areaId?: string }): Promise<GoalWithProgress[]> {
    const where: SQL[] = [isNull(goals.deletedAt), filter.archived ? isNotNull(goals.archivedAt) : isNull(goals.archivedAt)];
    if (filter.areaId) where.push(eq(goals.areaId, filter.areaId));
    return this.select()
      .where(and(...where))
      .orderBy(sql`${goals.targetDate} is null`, asc(goals.targetDate), asc(goals.createdAt));
  }

  async findWithProgress(id: string): Promise<GoalWithProgress | undefined> {
    const [row] = await this.select().where(eq(goals.id, id));
    return row;
  }

  async findById(id: string): Promise<GoalRow | undefined> {
    const [row] = await this.db.select().from(goals).where(eq(goals.id, id));
    return row;
  }

  async insert(values: typeof goals.$inferInsert): Promise<GoalRow> {
    const [row] = await this.db.insert(goals).values(values).returning();
    if (!row) throw new Error("goal insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof goals.$inferInsert>): Promise<void> {
    await this.db.update(goals).set(values).where(eq(goals.id, id));
  }

  async purge(id: string): Promise<void> {
    await this.db.delete(goals).where(eq(goals.id, id));
  }
}
