import type { TrashItem } from "../../shared/para";

type Row = { entity: TrashItem["entity"]; id: string; title: string; deleted_at: number };

/**
 * One query per table, sent together with d1.batch() (single round trip).
 * A single UNION ALL across all tables exceeds D1's compound-SELECT limit.
 *
 * Children deleted TOGETHER with their parent (same deleted_at, set by the
 * cascade) are hidden: restoring the parent restores them.
 */
const QUERIES = [
  `select 'area' as entity, id, name as title, deleted_at from areas where deleted_at is not null`,
  `select 'goal' as entity, id, title, deleted_at from goals where deleted_at is not null`,
  `select 'project' as entity, id, name as title, deleted_at from projects where deleted_at is not null`,
  `select 'note' as entity, id, case when title = '' then '(sem título)' else title end as title, deleted_at from notes where deleted_at is not null`,
  `select 'notebook' as entity, id, name as title, deleted_at from notebooks where deleted_at is not null`,
  `select 'resource' as entity, id, name as title, deleted_at from resources where deleted_at is not null`,
  `select 'bookmark' as entity, id, title, deleted_at from bookmarks where deleted_at is not null`,
  `select 'book' as entity, id, title, deleted_at from books where deleted_at is not null`,
  `select 'task' as entity, t.id, t.title, t.deleted_at from tasks t
     left join projects p on p.id = t.project_id
     left join tasks parent on parent.id = t.parent_task_id
    where t.deleted_at is not null
      and not (p.deleted_at is not null and p.deleted_at = t.deleted_at)
      and not (parent.deleted_at is not null and parent.deleted_at = t.deleted_at)`,
];

export class TrashRepository {
  constructor(private readonly d1: D1Database) {}

  async list(limit = 500): Promise<TrashItem[]> {
    // "order by 4" = deleted_at by position: the column name is ambiguous in the tasks join.
    const results = await this.d1.batch<Row>(QUERIES.map((q) => this.d1.prepare(`${q} order by 4 desc limit ${limit}`)));
    return results
      .flatMap((r) => r.results)
      .sort((a, b) => b.deleted_at - a.deleted_at)
      .slice(0, limit)
      .map((r) => ({ entity: r.entity, id: r.id, title: r.title, deletedAt: new Date(r.deleted_at).toISOString() }));
  }
}
