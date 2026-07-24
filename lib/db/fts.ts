import type { Client } from "@libsql/client";

// FTS5 full-text search over item title + body (raw_text).
//
// A standalone (contentless-external) FTS table rather than an "external
// content" table: item's primary key is a text UUID, but FTS5 external content
// requires an INTEGER rowid mapping. A standalone table sidesteps that and lets
// us carry item_id + project_id as UNINDEXED columns so search stays scoped to
// a project (the hard boundary) without a join back for filtering.
//
// The table is kept in sync by triggers on `item`. Everything here is
// idempotent, so migrate.ts can run it on every `db:migrate`.
const STATEMENTS = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS item_fts USING fts5(
    title,
    body,
    item_id UNINDEXED,
    project_id UNINDEXED,
    tokenize = 'porter unicode61'
  )`,

  `CREATE TRIGGER IF NOT EXISTS item_fts_ai AFTER INSERT ON item BEGIN
    INSERT INTO item_fts(title, body, item_id, project_id)
    VALUES (new.title, new.raw_text, new.id, new.project_id);
  END`,

  `CREATE TRIGGER IF NOT EXISTS item_fts_ad AFTER DELETE ON item BEGIN
    DELETE FROM item_fts WHERE item_id = old.id;
  END`,

  // Broad AFTER UPDATE (delete + reinsert) so title, body and project moves all
  // stay in sync. Simpler and correct; cheap at personal scale.
  `CREATE TRIGGER IF NOT EXISTS item_fts_au AFTER UPDATE ON item BEGIN
    DELETE FROM item_fts WHERE item_id = old.id;
    INSERT INTO item_fts(title, body, item_id, project_id)
    VALUES (new.title, new.raw_text, new.id, new.project_id);
  END`,

  // Backfill anything already in `item` but not yet indexed (idempotent).
  `INSERT INTO item_fts(title, body, item_id, project_id)
    SELECT title, raw_text, id, project_id FROM item
    WHERE id NOT IN (SELECT item_id FROM item_fts)`,
];

export async function applyFullTextSearch(client: Client): Promise<void> {
  for (const sql of STATEMENTS) {
    await client.execute(sql);
  }
}
