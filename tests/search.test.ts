import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { applyFullTextSearch } from "@/lib/db/fts";
import { searchItems } from "@/lib/db/search";
import { GET as searchGet } from "@/app/api/search/route";
import { searchDeps } from "@/app/api/search/deps";

const U1 = "user-a";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

// Minimal `item` table — just the columns the FTS triggers and search query
// touch — so the test exercises the real virtual table, triggers and snippet().
async function seededClient(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE item (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT,
      raw_text TEXT,
      status TEXT NOT NULL DEFAULT 'ready'
    )
  `);
  await applyFullTextSearch(client);

  const rows: Array<[string, string, string, string, string, string]> = [
    ["a", U1, P1, "Rucking", "The Fan Dance is a brutal ruck march.", "ready"],
    ["b", U1, P1, "Nutrition notes", "Liquid nutrition only on long efforts.", "ready"],
    ["c", U1, P2, "Other project", "ruck ruck in another project", "ready"],
    ["d", U1, P1, "Draft", "a ruck march draft not ready", "pending"],
  ];
  for (const [id, userId, projectId, title, body, status] of rows) {
    await client.execute({
      sql: "INSERT INTO item (id, user_id, project_id, title, raw_text, status) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, userId, projectId, title, body, status],
    });
  }
  return client;
}

test("FTS returns only ready items in the queried project, highlighted", async () => {
  const client = await seededClient();
  const hits = await searchItems({ userId: U1, projectId: P1, query: "ruck" }, client);

  // c is another project, d is not ready → only a survives.
  assert.deepEqual(
    hits.map((h) => h.itemId),
    ["a"]
  );
  assert.match(hits[0].snippet, /<mark>ruck<\/mark>/i);
});

test("FTS prefix matching hits partial words", async () => {
  const client = await seededClient();
  const hits = await searchItems({ userId: U1, projectId: P1, query: "brut" }, client);
  assert.deepEqual(
    hits.map((h) => h.itemId),
    ["a"]
  );
});

test("FTS is scoped to the project — same term, other project", async () => {
  const client = await seededClient();
  const hits = await searchItems({ userId: U1, projectId: P2, query: "ruck" }, client);
  assert.deepEqual(
    hits.map((h) => h.itemId),
    ["c"]
  );
});

test("FTS index tracks item deletes via trigger", async () => {
  const client = await seededClient();
  await client.execute({ sql: "DELETE FROM item WHERE id = ?", args: ["a"] });
  const hits = await searchItems({ userId: U1, projectId: P1, query: "ruck" }, client);
  assert.deepEqual(hits, []);
});

// --- Route validation (mocked deps) ---

type MutableDeps = Record<string, unknown>;
const original = { ...searchDeps };

beforeEach(() => {
  Object.assign(searchDeps as unknown as MutableDeps, original, {
    auth: async () => ({ userId: U1 }),
    requireProjectId: async () => P1,
    searchItems: async () => [
      { itemId: "a", title: "Rucking", snippet: "<mark>ruck</mark>", rank: -1 },
    ],
  });
});

afterEach(() => {
  Object.assign(searchDeps as unknown as MutableDeps, original);
});

function req(qs: string) {
  return new Request(`http://localhost/api/search?${qs}`);
}

test("route 401s without a user", async () => {
  Object.assign(searchDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: null }),
  });
  const res = await searchGet(req("q=ruck"));
  assert.equal(res.status, 401);
});

test("route 400s on a missing query", async () => {
  const res = await searchGet(req("q=%20"));
  assert.equal(res.status, 400);
});

test("route returns hits from the search layer", async () => {
  const res = await searchGet(req("q=ruck"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    results: [{ itemId: "a", title: "Rucking", snippet: "<mark>ruck</mark>", rank: -1 }],
  });
});
