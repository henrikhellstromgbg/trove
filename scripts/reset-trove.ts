import { config } from "dotenv";
config({ path: ".env.local" });

import { count } from "drizzle-orm";
import { db, schema, client } from "../lib/db";

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const wipeConfigs = args.includes("--wipe-configs");

  console.log(`Trove reset — ${confirm ? "live" : "preview"} mode`);
  console.log("");

  const [items] = await db.select({ n: count() }).from(schema.item);
  const [chunks] = await db.select({ n: count() }).from(schema.chunk);
  const [topics] = await db.select({ n: count() }).from(schema.topic);
  const [convs] = await db.select({ n: count() }).from(schema.conversation);
  const [msgs] = await db.select({ n: count() }).from(schema.message);
  const [runs] = await db.select({ n: count() }).from(schema.pipelineRun);
  const [pipes] = await db.select({ n: count() }).from(schema.pipeline);

  console.log(`  items:          ${items.n}  → delete`);
  console.log(`  chunks:         ${chunks.n}  → delete`);
  console.log(`  topics:         ${topics.n}  → delete`);
  console.log(`  conversations:  ${convs.n}  → delete`);
  console.log(`  messages:       ${msgs.n}  → delete`);
  console.log(`  pipeline_runs:  ${runs.n}  → delete`);
  console.log(`  pipelines:      ${pipes.n}  → ${wipeConfigs ? "delete" : "KEEP"}`);
  console.log("");

  if (!confirm) {
    console.log("(preview only — re-run with --confirm to actually delete)");
    console.log("(add --wipe-configs to also delete pipelines)");
    client.close();
    return;
  }

  console.log("deleting...");
  await db.delete(schema.message);
  await db.delete(schema.conversation);
  await db.delete(schema.chunk);
  await db.delete(schema.topic);
  await db.delete(schema.pipelineRun);
  await db.delete(schema.item);

  if (wipeConfigs) {
    await db.delete(schema.pipeline);
  }

  client.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
