import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "../lib/db/schema";

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  const items = await db.execute(sql`
    SELECT id, type, status, title, source, captured_at, processed_at
    FROM item
    ORDER BY captured_at DESC
    LIMIT 10
  `);
  console.log("Items (latest 10):");
  console.table(items.rows);

  const chunkCount = await db.execute(sql`SELECT COUNT(*) FROM chunk`);
  console.log("Chunk count:", chunkCount.rows[0]);

  const vectorDim = await db.execute(sql`
    SELECT atttypmod
    FROM pg_attribute
    WHERE attrelid = 'chunk'::regclass AND attname = 'embedding'
  `);
  console.log("Vector column atttypmod (expected 772 for vector(768)):", vectorDim.rows[0]);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
