import { HL_END, HL_START, type SearchEntity, type SearchResult } from "../../../shared/knowledge";

/**
 * Turns free user text into a safe FTS5 query: every word becomes a quoted
 * prefix term ("word"*), so FTS5 operators typed by the user (AND, NEAR, *, :,
 * quotes, parentheses) are treated as plain text, never as syntax.
 */
export function toFtsQuery(input: string): string | null {
  const words = input.normalize("NFC").match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
  if (!words.length) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

export class SearchRepository {
  constructor(private readonly d1: D1Database) {}

  async search(input: string, types: SearchEntity[] | undefined, limit: number): Promise<SearchResult[]> {
    const match = toFtsQuery(input);
    if (!match) return [];
    // All parameters are explicitly numbered (mixing `?` and `?N` renumbers anonymous ones).
    const typeFilter = types?.length ? `AND entity_type IN (${types.map((_, i) => `?${i + 5}`).join(",")})` : "";
    const { results } = await this.d1
      .prepare(
        `SELECT entity_type, entity_id,
                highlight(search_index, 2, ?1, ?2) AS title,
                snippet(search_index, 3, ?1, ?2, '…', 14) AS snippet,
                bm25(search_index, 0.0, 0.0, 8.0, 1.0) AS score
           FROM search_index
          WHERE search_index MATCH ?3 ${typeFilter}
          ORDER BY score
          LIMIT ?4`,
      )
      .bind(HL_START, HL_END, match, limit, ...(types ?? []))
      .all<{ entity_type: SearchEntity; entity_id: string; title: string; snippet: string; score: number }>();
    return results.map((r) => ({ entity: r.entity_type, id: r.entity_id, title: r.title, snippet: r.snippet, score: r.score }));
  }
}
