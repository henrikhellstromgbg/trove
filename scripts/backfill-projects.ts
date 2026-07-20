import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Phase 1 backfill. Idempotent. Safe to run more than once.
//
// For every user that owns rows, ensure a default "inbox" project exists,
// then point any null project_id rows at it. Run AFTER db:push has added the
// project table and the nullable project_id columns. Run BEFORE enforcing
// project_id NOT NULL.
//
//   pnpm tsx scripts/backfill-projects.ts
//
// space rows are intentionally not migrated. They are soft tag groupings,
// low value, and retired in the same phase. See docs/architecture-v2.md.

const OWNED_TABLES = [
  "item",
  "chunk",
  "conversation",
  "pipeline",
  "topic",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });

  try {
    // Every distinct owner across the owned tables.
    const { rows: userRows } = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM (
         SELECT user_id FROM item
         UNION SELECT user_id FROM chunk
         UNION SELECT user_id FROM conversation
         UNION SELECT user_id FROM pipeline
         UNION SELECT user_id FROM topic
       ) u
       WHERE user_id IS NOT NULL`
    );

    if (userRows.length === 0) {
      console.log("no rows to backfill, nothing to do");
      return;
    }

    for (const { user_id } of userRows) {
      // Ensure the default project. Unique (user_id, slug) makes this idempotent.
      const { rows: projRows } = await pool.query<{ id: string }>(
        `INSERT INTO project (user_id, name, slug, kind)
         VALUES ($1, 'inbox', 'inbox', 'personal')
         ON CONFLICT (user_id, slug) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [user_id]
      );
      const projectId = projRows[0].id;

      let moved = 0;
      for (const table of OWNED_TABLES) {
        const { rowCount } = await pool.query(
          `UPDATE ${table}
             SET project_id = $1
           WHERE user_id = $2 AND project_id IS NULL`,
          [projectId, user_id]
        );
        moved += rowCount ?? 0;
      }
      console.log(`user ${user_id}: default project ${projectId}, ${moved} rows backfilled`);
    }

    // Report any stragglers, rows that would block the NOT NULL step.
    for (const table of OWNED_TABLES) {
      const { rows } = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${table} WHERE project_id IS NULL`
      );
      const n = Number(rows[0].count);
      if (n > 0) console.warn(`WARNING: ${table} still has ${n} rows with null project_id`);
    }

    console.log("backfill complete");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
