import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { schema } from "@/lib/db";
import { moveItemToProject, moveItemDeps, SameProjectMoveError } from "@/lib/items/move";
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

const originalDeps = { ...moveItemDeps };
afterEach(() => Object.assign(moveItemDeps as unknown as MutableDeps, originalDeps));

// A small relational mock: enough of select/insert/update/transaction for the
// move and copy paths, recording the writes it applies for assertions.
class MockDb {
  items: Row[];
  updates: Array<{ table: string; set: Row }> = [];
  private seq = 1;

  constructor(items: Row[]) {
    this.items = items;
  }

  private tableName(table: unknown): string {
    if (table === schema.item) return "item";
    if (table === schema.chunk) return "chunk";
    if (table === schema.topic) return "topic";
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

  private client() {
    return {
      insert: (table: unknown) => {
        const name = this.tableName(table);
        let values: Row = {};
        const chain = {
          values: (v: Row) => {
            values = v;
            return chain;
          },
          returning: async () => {
            const id = `new-item-${this.seq++}`;
            if (name === "item") this.items.push({ id, ...values });
            return [{ id }];
          },
        };
        return chain;
      },
      update: (table: unknown) => {
        const name = this.tableName(table);
        let set: Row = {};
        const chain = {
          set: (v: Row) => {
            set = v;
            return chain;
          },
          where: async () => {
            this.updates.push({ table: name, set });
            return [];
          },
        };
        return chain;
      },
    };
  }

  insert(table: unknown) {
    return this.client().insert(table);
  }
  update(table: unknown) {
    return this.client().update(table);
  }
  async transaction<T>(cb: (tx: ReturnType<MockDb["client"]>) => Promise<T>): Promise<T> {
    return cb(this.client());
  }
}

function baseItem(over: Row): Row {
  return {
    id: ITEM_ID,
    userId: USER,
    projectId: PROJECT_A,
    sourceId: null,
    status: "ready",
    type: "text",
    source: null,
    rawText: "some text",
    ...over,
  };
}

test("a manual (sourceId null) item is moved: item and chunks re-scoped, dropped from old topics", async () => {
  const db = new MockDb([baseItem({})]);
  Object.assign(moveItemDeps as unknown as MutableDeps, { db, sendItemCaptured: async () => {} });

  const result = await moveItemToProject(USER, ITEM_ID, PROJECT_B);

  assert.deepEqual(result, { action: "moved", itemId: ITEM_ID });
  const tables = db.updates.map((u) => u.table);
  assert.deepEqual(tables, ["item", "chunk", "topic"]);
  assert.equal(db.updates[0]?.set.projectId, PROJECT_B); // item
  assert.equal(db.updates[1]?.set.projectId, PROJECT_B); // chunks
  // No new item was created.
  assert.equal(db.items.length, 1);
});

test("a source-attributed item is copied, not moved, detached from the source and reprocessed", async () => {
  const db = new MockDb([baseItem({ sourceId: "src-1", type: "url", source: "https://x/y" })]);
  let captured: string | null = null;
  Object.assign(moveItemDeps as unknown as MutableDeps, {
    db,
    sendItemCaptured: async (id: string) => {
      captured = id;
    },
  });

  const result = await moveItemToProject(USER, ITEM_ID, PROJECT_B);

  assert.equal(result.action, "copied");
  assert.equal(db.items.length, 2); // original + copy
  const copy = db.items[1]!;
  assert.equal(copy.projectId, PROJECT_B);
  assert.equal(copy.sourceId, null); // detached from the origin's source
  assert.equal(copy.externalId, null);
  assert.equal(copy.status, "pending"); // reprocessed in the destination
  assert.equal(copy.type, "url");
  assert.equal(copy.source, "https://x/y");
  assert.equal(captured, copy.id); // enqueued for processing
  // The original is untouched (no updates in the copy path).
  assert.equal(db.updates.length, 0);
});

test("moving an item the user does not own is InvalidItemError", async () => {
  const db = new MockDb([baseItem({ userId: "someone-else" })]);
  Object.assign(moveItemDeps as unknown as MutableDeps, { db, sendItemCaptured: async () => {} });
  await assert.rejects(() => moveItemToProject(USER, ITEM_ID, PROJECT_B), InvalidItemError);
});

test("moving a not-ready item is InvalidItemStateError", async () => {
  const db = new MockDb([baseItem({ status: "pending" })]);
  Object.assign(moveItemDeps as unknown as MutableDeps, { db, sendItemCaptured: async () => {} });
  await assert.rejects(() => moveItemToProject(USER, ITEM_ID, PROJECT_B), InvalidItemStateError);
});

test("moving into the item's current project is SameProjectMoveError", async () => {
  const db = new MockDb([baseItem({ projectId: PROJECT_A })]);
  Object.assign(moveItemDeps as unknown as MutableDeps, { db, sendItemCaptured: async () => {} });
  await assert.rejects(() => moveItemToProject(USER, ITEM_ID, PROJECT_A), SameProjectMoveError);
});

test("a non-uuid itemId is InvalidItemError before any query", async () => {
  const db = new MockDb([]);
  Object.assign(moveItemDeps as unknown as MutableDeps, { db, sendItemCaptured: async () => {} });
  await assert.rejects(() => moveItemToProject(USER, "not-a-uuid", PROJECT_B), InvalidItemError);
});
