import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
if (process.env.DATABASE_WS_PROXY) {
  neonConfig.wsProxy = () => process.env.DATABASE_WS_PROXY!;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}

// Baseline a db:push-created database onto the Drizzle migration track WITHOUT
// executing the SQL of migrations it already contains. It records the given
// migrations in drizzle.__drizzle_migrations (matching the migrator's own hash
// and created_at), so a subsequent `db:migrate` applies only the migrations
// that come after — never re-running CREATE TABLE on tables that already exist.
//
// SAFETY: this writes to whatever DATABASE_URL points at. It refuses to run
// unless you pass --confirm-database <name> and that name matches the database
// in DATABASE_URL, so it cannot be aimed at prod by accident. It also never runs
// migration SQL and never touches application tables — only the journal.
//
// Usage:
//   DATABASE_URL=... npx tsx scripts/baseline-migrations.ts \
//     --through <tag|count> --confirm-database <name> [--dry-run]
// Examples:
//   --through 0001_secret_violations   (mark 0000 and 0001 as applied)
//   --through 2                        (mark the first 2 migrations as applied)
//   --through all                      (mark every migration as applied)

type Args = {
  through: string;
  confirmDatabase?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { through: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--through") args.through = argv[++i] ?? "";
    else if (argv[i] === "--confirm-database") args.confirmDatabase = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

function databaseNameFromUrl(url: string): string {
  const path = new URL(url).pathname;
  return path.replace(/^\//, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!args.through) {
    throw new Error("--through <tag|count|all> is required");
  }

  const dbName = databaseNameFromUrl(url);
  if (args.confirmDatabase !== dbName) {
    throw new Error(
      `Refusing to run. Pass --confirm-database ${dbName} to confirm the target ` +
        `database (got ${args.confirmDatabase ?? "nothing"}). This guard exists so ` +
        `the script can never be aimed at the wrong (e.g. production) database.`
    );
  }

  const migrations = readMigrationFiles({ migrationsFolder: "./lib/db/migrations" });
  // readMigrationFiles returns them ordered by folderMillis; pair each with its
  // tag from the journal order (index) for --through matching.
  const ordered = migrations
    .slice()
    .sort((a, b) => a.folderMillis - b.folderMillis);

  let count: number;
  if (args.through === "all") {
    count = ordered.length;
  } else if (/^\d+$/.test(args.through)) {
    count = Number(args.through);
  } else {
    // Resolve a tag like "0001_secret_violations" to a position via the journal,
    // whose entry order matches readMigrationFiles' folderMillis order.
    const { readFileSync } = await import("node:fs");
    const journal = JSON.parse(
      readFileSync("./lib/db/migrations/meta/_journal.json", "utf8")
    ) as { entries: Array<{ idx: number; tag: string }> };
    const entry = journal.entries.find((e) => e.tag === args.through);
    if (!entry) {
      throw new Error(`--through "${args.through}" did not match a journal tag or a count`);
    }
    count = entry.idx + 1;
  }

  if (count < 1 || count > ordered.length) {
    throw new Error(`--through resolved to ${count}, out of range 1..${ordered.length}`);
  }

  const toBaseline = ordered.slice(0, count);

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await pool.query(
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (' +
        "id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)"
    );

    const existing = await pool.query<{ hash: string }>(
      'SELECT hash FROM "drizzle"."__drizzle_migrations"'
    );
    const have = new Set(existing.rows.map((r) => r.hash));

    let inserted = 0;
    for (const m of toBaseline) {
      if (have.has(m.hash)) {
        console.log(`already recorded: ${m.hash.slice(0, 12)}… (skipped)`);
        continue;
      }
      console.log(
        `${args.dryRun ? "[dry-run] would record" : "recording"}: ` +
          `${m.hash.slice(0, 12)}… created_at=${m.folderMillis}`
      );
      if (!args.dryRun) {
        await pool.query(
          'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
          [m.hash, m.folderMillis]
        );
        inserted++;
      }
    }

    console.log(
      `\nBaselined ${args.dryRun ? "0 (dry-run)" : inserted} of ${toBaseline.length} ` +
        `requested migration(s) into ${dbName}. A subsequent db:migrate will apply ` +
        `only migrations after the highest recorded created_at.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
