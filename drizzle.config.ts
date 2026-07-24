import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

// Local-first SQLite. The whole DB is a single file in the repo (gitignored),
// resolved the same way the app resolves it in lib/db/index.ts.
const url = process.env.TROVE_DB_URL ?? "file:./data/trove.db";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url },
});
