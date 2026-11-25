import type { TrashItem } from "../../shared/para";

/**
 * Lists soft-deleted PARA items. Children deleted TOGETHER with their parent
 * (same deleted_at, set by the cascade) are hidden: restoring the parent
 * restores them, so listing them separately would only add noise.
 */
export class TrashRepository {
  constructor(private readonly d1: D1Database) {}

  async list(): Promise<TrashItem[]> {
    const { results } = await this.d1
      .prepare(
        `select 'area' as entity, id, name as title, deleted_at from areas where deleted_at is not null
         union all
         select 'goal', id, title, deleted_at from goals where deleted_at is not null
         union all
         select 'project', id, name, deleted_at from projects where deleted_at is not null
         union all
         select 'task', t.id, t.title, t.deleted_at from tasks t
           left join projects p on p.id = t.project_id
           left join tasks parent on parent.id = t.parent_task_id
           where t.deleted_at is not null
             and not (p.deleted_at is not null and p.deleted_at = t.deleted_at)
             and not (parent.deleted_at is not null and parent.deleted_at = t.deleted_at)
         order by deleted_at desc
         limit 500`,
      )
      .all<{ entity: TrashItem["entity"]; id: string; title: string; deleted_at: number }>();
    return results.map((r) => ({ entity: r.entity, id: r.id, title: r.title, deletedAt: new Date(r.deleted_at).toISOString() }));
  }
}
