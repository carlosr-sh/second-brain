import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { areas } from "../db/schema";
import { ACTIVE_PROJECT_STATUSES, OPEN_TASK_STATUSES } from "./_shared";

export type AreaRow = typeof areas.$inferSelect;
export type AreaWithStats = AreaRow & { activeProjects: number; openTasks: number };

export class AreaRepository {
  constructor(private readonly db: Database) {}

  private withStats() {
    return {
      ...this.columns(),
      activeProjects: sql<number>`(select count(*) from projects p where p.area_id = ${sql.raw("areas.id")}
        and p.deleted_at is null and p.archived_at is null and p.status in ${sql.raw(ACTIVE_PROJECT_STATUSES)})`,
      openTasks: sql<number>`(select count(*) from tasks t left join projects p on p.id = t.project_id
        where t.deleted_at is null and t.archived_at is null and t.status in ${sql.raw(OPEN_TASK_STATUSES)}
        and (t.area_id = ${sql.raw("areas.id")} or (p.area_id = ${sql.raw("areas.id")} and p.deleted_at is null)))`,
    };
  }

  private columns() {
    const { id, name, description, icon, color, position, archivedAt, deletedAt, createdAt, updatedAt } = areas;
    return { id, name, description, icon, color, position, archivedAt, deletedAt, createdAt, updatedAt };
  }

  list(archived: boolean): Promise<AreaWithStats[]> {
    return this.db
      .select(this.withStats())
      .from(areas)
      .where(and(isNull(areas.deletedAt), archived ? isNotNull(areas.archivedAt) : isNull(areas.archivedAt)))
      .orderBy(asc(areas.position), asc(areas.name));
  }

  async findWithStats(id: string): Promise<AreaWithStats | undefined> {
    const [row] = await this.db.select(this.withStats()).from(areas).where(eq(areas.id, id));
    return row;
  }

  async findById(id: string): Promise<AreaRow | undefined> {
    const [row] = await this.db.select().from(areas).where(eq(areas.id, id));
    return row;
  }

  async nextPosition(): Promise<number> {
    const [row] = await this.db.select({ max: sql<number | null>`max(${areas.position})` }).from(areas);
    return (row?.max ?? 0) + 1;
  }

  async insert(values: typeof areas.$inferInsert): Promise<AreaRow> {
    const [row] = await this.db.insert(areas).values(values).returning();
    if (!row) throw new Error("area insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof areas.$inferInsert>): Promise<void> {
    await this.db.update(areas).set(values).where(eq(areas.id, id));
  }

  async purge(id: string): Promise<void> {
    await this.db.delete(areas).where(eq(areas.id, id));
  }
}
