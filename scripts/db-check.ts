import { config } from "dotenv";
config({ path: ".env.local" });

import { client } from "../lib/db";
import { decodeEmbedding } from "../lib/db/vector";

async function main() {
  const items = await client.execute(`
    SELECT id, type, status, title, source, captured_at, processed_at
    FROM item
    ORDER BY captured_at DESC
    LIMIT 10
  `);
  console.log("Items (latest 10):");
  console.table(items.rows);

  const chunkCount = await client.execute("SELECT COUNT(*) AS n FROM chunk");
  console.log("Chunk count:", chunkCount.rows[0]?.n);

  // Sanity-check the stored embedding blob decodes to the expected dimension.
  const sample = await client.execute(
    "SELECT embedding FROM chunk WHERE embedding IS NOT NULL LIMIT 1"
  );
  const dim = decodeEmbedding(sample.rows[0]?.embedding ?? null)?.length ?? 0;
  console.log("Embedding dims (expected 768):", dim);

  // Full-text index health.
  const ftsCount = await client.execute("SELECT COUNT(*) AS n FROM item_fts");
  console.log("item_fts rows:", ftsCount.rows[0]?.n);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
