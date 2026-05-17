import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });

  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("pgvector extension ready");

  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("migrations applied");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
