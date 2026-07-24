import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { applyFullTextSearch } from "./fts";

async function main() {
  const url = process.env.TROVE_DB_URL ?? "file:./data/trove.db";
  if (url.startsWith("file:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({ url });
  await client.execute("PRAGMA foreign_keys = ON");

  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("migrations applied");

  // FTS5 virtual table + triggers live outside Drizzle's generated migrations
  // (drizzle-kit can't express them). Idempotent, so it runs every migrate.
  await applyFullTextSearch(client);
  console.log("full-text search ready");

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
