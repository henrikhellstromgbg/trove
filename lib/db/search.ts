import type { Client } from "@libsql/client";
import { client } from "./index";

export type ItemSearchHit = {
  itemId: string;
  title: string | null;
  snippet: string;
  rank: number;
};

// Turn free-text into a safe FTS5 MATCH expression: each whitespace token
// becomes a quoted prefix term ANDed together, e.g. `ruck march` ->
// `"ruck"* "bar"*`. Quoting (with "" escaping) neutralises FTS5 operators in
// user input; the trailing * gives prefix matching so partial words still hit.
function toMatchExpression(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`);
  return tokens.join(" ");
}

// Full-text search over item title + body, scoped to a single project (the hard
// boundary) and the owning user. Returns item ids ranked best-first with a
// highlighted snippet of the body. `<mark>…</mark>` marks the matched terms.
export async function searchItems(
  params: {
    userId: string;
    projectId: string;
    query: string;
    limit?: number;
  },
  sqlClient: Client = client
): Promise<ItemSearchHit[]> {
  const match = toMatchExpression(params.query);
  if (!match) return [];

  const limit = params.limit ?? 20;

  const result = await sqlClient.execute({
    sql: `
      SELECT
        f.item_id AS itemId,
        i.title   AS title,
        snippet(item_fts, 1, '<mark>', '</mark>', '…', 12) AS snippet,
        bm25(item_fts) AS rank
      FROM item_fts AS f
      JOIN item AS i ON i.id = f.item_id
      WHERE item_fts MATCH ?
        AND f.project_id = ?
        AND i.user_id = ?
        AND i.status = 'ready'
      ORDER BY rank
      LIMIT ?
    `,
    args: [match, params.projectId, params.userId, limit],
  });

  return result.rows.map((row) => ({
    itemId: String(row.itemId),
    title: row.title === null ? null : String(row.title),
    snippet: String(row.snippet ?? ""),
    rank: Number(row.rank),
  }));
}
