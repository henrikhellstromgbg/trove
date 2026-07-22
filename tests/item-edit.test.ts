import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { schema } from "@/lib/db";
import { editItem, reprocessItem, editItemDeps } from "@/lib/items/edit";
import {
  InvalidItemError,
  InvalidItemStateError,
} from "@/lib/review-or-deletion/contracts";

type MutableDeps = Record<string, unknown>;
type Row = Record<string, unknown>;

const USER = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

const originalDeps = { ...editItemDeps };
afterEach(() => Object.assign(editItemDeps as unknown as MutableDeps, originalDeps));

// Enough of select/update/delete to exercise edit and reprocess, recording the
// writes so tests can assert what actually happened (and what didn't).
class MockDb {
  items: Row[];
  updates: Array<{ table: string; set: Row }> = [];
  deletes: string[] = [];

  constructor(items: Row[]) {
    this.items = items;
  }

  private tableName(table: unknown): string {
    if (table === schema.item) return "item";
    if (table === schema.chunk) return "chunk";
    throw new Error("unexpected table");
  }

  select() {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => this.items,
    };
    return chain;
  }

  update(table: unknown) {
    const name = this.tableName(table);
    const item = this.items[0] ?? {};
    let set: Row = {};
    const chain = {
      set: (v: Row) => {
        set = v;
        return chain;
      },
      where: () => {
        this.updates.push({ table: name, set });
        // Awaitable for the plain update path, chainable to returning() for edit.
        return {
          returning: async () => [
            {
              id: item.id,
              title: set.title ?? null,
              tags: set.tags ?? [],
              status: set.status ?? item.status,
            },
          ],
          then: (resolve: (v: Row[]) => void) => resolve([]),
        };
      },
    };
    return chain;
  }

  delete(table: unknown) {
    const name = this.tableName(table);
    return {
      where: async () => {
        this.deletes.push(name);
        return [];
      },
    };
  }
}

function baseItem(over: Row): Row {
  return {
    id: ITEM_ID,
    userId: USER,
    projectId: PROJECT_A,
    status: "ready",
    title: "old title",
    tags: ["a"],
    ...over,
  };
}

function useDb(db: MockDb, captured?: { id: string | null }) {
  Object.assign(editItemDeps as unknown as MutableDeps, {
    db,
    sendItemCaptured: async (id: string) => {
      if (captured) captured.id = id;
    },
  });
}

// --- editItem: rename / retag ---

test("editItem renames the title and updates only the item", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  const result = await editItem(USER, PROJECT_A, ITEM_ID, { title: "  new name  " });
  assert.equal(result.title, "new name"); // trimmed
  assert.deepEqual(db.updates.map((u) => u.table), ["item"]);
  assert.equal(db.updates[0]?.set.title, "new name");
  assert.equal("tags" in (db.updates[0]?.set ?? {}), false); // tags untouched
});

test("editItem normalizes tags: trims, drops empties, dedupes", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  const result = await editItem(USER, PROJECT_A, ITEM_ID, {
    tags: [" x ", "x", "", "y"],
  });
  assert.deepEqual(result.tags, ["x", "y"]);
  assert.deepEqual(db.updates[0]?.set.tags, ["x", "y"]);
});

test("editItem accepts an empty tag array to clear tags", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  const result = await editItem(USER, PROJECT_A, ITEM_ID, { tags: [] });
  assert.deepEqual(result.tags, []);
  assert.deepEqual(db.updates[0]?.set.tags, []);
});

test("editItem with neither title nor tags is a state error and writes nothing", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  await assert.rejects(() => editItem(USER, PROJECT_A, ITEM_ID, {}), InvalidItemStateError);
  assert.equal(db.updates.length, 0);
});

test("editItem with an empty title is a state error and writes nothing", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  await assert.rejects(
    () => editItem(USER, PROJECT_A, ITEM_ID, { title: "   " }),
    InvalidItemStateError
  );
  assert.equal(db.updates.length, 0);
});

test("editItem rejects non-string tag entries and writes nothing", async () => {
  const db = new MockDb([baseItem({})]);
  useDb(db);
  await assert.rejects(
    () => editItem(USER, PROJECT_A, ITEM_ID, { tags: ["ok", 3] as unknown }),
    InvalidItemStateError
  );
  assert.equal(db.updates.length, 0);
});

test("editItem on a trashed item is refused", async () => {
  const db = new MockDb([baseItem({ status: "trashed" })]);
  useDb(db);
  await assert.rejects(
    () => editItem(USER, PROJECT_A, ITEM_ID, { title: "x" }),
    InvalidItemStateError
  );
  assert.equal(db.updates.length, 0);
});

test("editItem on a foreign user's item is InvalidItemError", async () => {
  const db = new MockDb([baseItem({ userId: "someone-else" })]);
  useDb(db);
  await assert.rejects(
    () => editItem(USER, PROJECT_A, ITEM_ID, { title: "x" }),
    InvalidItemError
  );
  assert.equal(db.updates.length, 0);
});

test("editItem scoped to the wrong project is InvalidItemError", async () => {
  const db = new MockDb([baseItem({ projectId: PROJECT_A })]);
  useDb(db);
  await assert.rejects(
    () => editItem(USER, PROJECT_B, ITEM_ID, { title: "x" }),
    InvalidItemError
  );
  assert.equal(db.updates.length, 0);
});

// --- reprocessItem ---

test("reprocess a ready item: chunks deleted, status reset to pending, item/captured emitted", async () => {
  const db = new MockDb([baseItem({ status: "ready" })]);
  const captured = { id: null as string | null };
  useDb(db, captured);

  const result = await reprocessItem(USER, PROJECT_A, ITEM_ID);

  assert.deepEqual(result, { id: ITEM_ID, status: "pending" });
  assert.deepEqual(db.deletes, ["chunk"]); // chunks cleared before replay
  assert.equal(db.updates[0]?.set.status, "pending");
  assert.equal(captured.id, ITEM_ID); // enqueued for the worker
});

test("reprocess a failed item is allowed", async () => {
  const db = new MockDb([baseItem({ status: "failed" })]);
  const captured = { id: null as string | null };
  useDb(db, captured);
  const result = await reprocessItem(USER, PROJECT_A, ITEM_ID);
  assert.equal(result.status, "pending");
  assert.equal(captured.id, ITEM_ID);
});

test("reprocess an in-flight (processing) item is refused and touches nothing", async () => {
  const db = new MockDb([baseItem({ status: "processing" })]);
  const captured = { id: null as string | null };
  useDb(db, captured);
  await assert.rejects(
    () => reprocessItem(USER, PROJECT_A, ITEM_ID),
    InvalidItemStateError
  );
  assert.deepEqual(db.deletes, []);
  assert.equal(db.updates.length, 0);
  assert.equal(captured.id, null);
});

test("reprocess a trashed item is refused", async () => {
  const db = new MockDb([baseItem({ status: "trashed" })]);
  useDb(db);
  await assert.rejects(
    () => reprocessItem(USER, PROJECT_A, ITEM_ID),
    InvalidItemStateError
  );
  assert.deepEqual(db.deletes, []);
});

test("reprocess a foreign user's item is InvalidItemError, nothing deleted", async () => {
  const db = new MockDb([baseItem({ userId: "someone-else" })]);
  useDb(db);
  await assert.rejects(() => reprocessItem(USER, PROJECT_A, ITEM_ID), InvalidItemError);
  assert.deepEqual(db.deletes, []);
});

test("a non-uuid itemId is InvalidItemError before any query", async () => {
  const db = new MockDb([]);
  useDb(db);
  await assert.rejects(() => editItem(USER, PROJECT_A, "nope", { title: "x" }), InvalidItemError);
  await assert.rejects(() => reprocessItem(USER, PROJECT_A, "nope"), InvalidItemError);
});
