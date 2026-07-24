import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

// Local-first: the entire database is one SQLite file in the repo (gitignored).
// Override with TROVE_DB_URL (a libsql URL) for tests or an alternate location.
export const dbUrl = process.env.TROVE_DB_URL ?? "file:./data/trove.db";

// libsql creates the file but not its parent directory.
if (dbUrl.startsWith("file:")) {
  mkdirSync(dirname(dbUrl.slice("file:".length)), { recursive: true });
}

export const client = createClient({ url: dbUrl });

// SQLite disables foreign keys per-connection by default; turn them on so the
// onDelete actions declared in schema.ts actually cascade. WAL improves
// read/write concurrency under the dev server. Both are queued on the
// connection before any request-time query runs.
void client.execute("PRAGMA foreign_keys = ON");
void client.execute("PRAGMA journal_mode = WAL");

export const db = drizzle({ client, schema });
export { schema };
