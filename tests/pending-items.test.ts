import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import {
  claimPendingItem,
  reemitPendingItems,
} from "@/lib/inngest/pending-items";

const clients: Client[] = [];

async function queueDb() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(`
    CREATE TABLE item (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      captured_at INTEGER NOT NULL
    )
  `);
  return { client, database: drizzle({ client, schema }) };
}

async function seed(
  client: Client,
  id: string,
  status: string,
  capturedAt: number
) {
  await client.execute({
    sql: "INSERT INTO item (id, user_id, project_id, type, status, captured_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, "user", "project", "text", status, capturedAt],
  });
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

test("claimPendingItem lets only one delivery claim a pending item", async () => {
  const { client, database } = await queueDb();
  await seed(client, "pending", "pending", 1);

  assert.equal(await claimPendingItem("pending", database), true);
  assert.equal(await claimPendingItem("pending", database), false);

  const row = await client.execute("SELECT status FROM item WHERE id = 'pending'");
  assert.equal(row.rows[0]?.status, "processing");
});

test("claimPendingItem does not restart non-pending items", async () => {
  const { client, database } = await queueDb();
  await seed(client, "ready", "ready", 1);
  await seed(client, "processing", "processing", 2);

  assert.equal(await claimPendingItem("ready", database), false);
  assert.equal(await claimPendingItem("processing", database), false);
});

test("reemitPendingItems emits the oldest pending batch only", async () => {
  const { client, database } = await queueDb();
  await seed(client, "newer", "pending", 30);
  await seed(client, "ready", "ready", 10);
  await seed(client, "oldest", "pending", 20);
  const emitted: string[] = [];

  const ids = await reemitPendingItems(
    async (event) => {
      emitted.push(event.data.itemId);
    },
    database,
    1
  );

  assert.deepEqual(ids, ["oldest"]);
  assert.deepEqual(emitted, ["oldest"]);
});
