import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as ingestPost } from "@/app/api/ingest/route";
import { ingestDeps } from "@/app/api/ingest/deps";
import { DELETE as itemDelete } from "@/app/api/items/[id]/route";
import { POST as restorePost } from "@/app/api/items/[id]/restore/route";
import { itemRouteDeps } from "@/app/api/items/deps";
import { GET as reviewGet, POST as reviewPost } from "@/app/api/items/review/route";
import { POST as trashPost } from "@/app/api/items/trash/route";
import { schema } from "@/lib/db";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemStateError,
  trashDeleteAt,
} from "@/lib/review-or-deletion/contracts";
import {
  applyReviewDecision,
  permanentlyDeleteItem,
  restoreItem,
  reviewOrDeletionDeps,
} from "@/lib/review-or-deletion/store";

type MutableDeps = Record<string, unknown>;
type TableRow = Record<string, unknown>;

const USER_ID = "user-a";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-07-21T12:00:00.000Z");

const originalItemRouteDeps = { ...itemRouteDeps };
const originalIngestDeps = { ...ingestDeps };
const originalReviewOrDeletionDeps = { ...reviewOrDeletionDeps };

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fileRequest(path: string, fields: Record<string, string>) {
  const form = new FormData();
  form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: form });
}

type LifecycleState = {
  items: TableRow[];
  reviewDecisions: TableRow[];
  deletionMarkers: TableRow[];
  originalRecords: TableRow[];
};

function cloneState(state: LifecycleState): LifecycleState {
  return structuredClone(state);
}

function projectRows(rows: TableRow[], fields?: Record<string, { name: string }>) {
  if (!fields) return rows;
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(fields)) {
      projected[key] = Object.prototype.hasOwnProperty.call(row, key)
        ? row[key]
        : row[column.name];
    }
    return projected;
  });
}

function tableName(table: unknown): keyof LifecycleState {
  if (table === schema.item) return "items";
  if (table === schema.reviewDecision) return "reviewDecisions";
  if (table === schema.deletionMarker) return "deletionMarkers";
  if (table === schema.originalRecord) return "originalRecords";
  throw new Error("unexpected table");
}

class MockLifecycleDb {
  state: LifecycleState;
  failTransaction = false;
  private reviewDecisionSeq = 1;
  private deletionMarkerSeq = 1;

  constructor(initial?: Partial<LifecycleState>) {
    this.state = {
      items: initial?.items ?? [],
      reviewDecisions: initial?.reviewDecisions ?? [],
      deletionMarkers: initial?.deletionMarkers ?? [],
      originalRecords: initial?.originalRecords ?? [],
    };
  }

  async transaction<T>(callback: (tx: MockLifecycleDb) => Promise<T>): Promise<T> {
    if (this.failTransaction) {
      throw new Error("transaction failed");
    }
    const snapshot = cloneState(this.state);
    const tx = new MockLifecycleDb(snapshot);
    tx.reviewDecisionSeq = this.reviewDecisionSeq;
    tx.deletionMarkerSeq = this.deletionMarkerSeq;

    const result = await callback(tx);
    this.state = tx.state;
    this.reviewDecisionSeq = tx.reviewDecisionSeq;
    this.deletionMarkerSeq = tx.deletionMarkerSeq;
    return result;
  }

  select(fields?: Record<string, { name: string }>) {
    let selected: keyof LifecycleState | null = null;
    const resolveRows = () => {
      if (!selected) throw new Error("missing table");
      return projectRows(this.state[selected], fields);
    };
    const chain = {
      from: (table: unknown) => {
        selected = tableName(table);
        return chain;
      },
      where: () => chain,
      orderBy: () => chain,
      limit: async () => resolveRows(),
      then: <TResult1 = TableRow[], TResult2 = never>(
        onfulfilled?: ((value: TableRow[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(resolveRows() as TableRow[]).then(onfulfilled, onrejected),
    };
    return chain;
  }

  insert(table: unknown) {
    const target = tableName(table);
    let values: TableRow[] = [];
    let ignoreConflicts = false;
    let applied = false;
    let insertedRows: TableRow[] = [];

    const applyInsert = () => {
      if (applied) return insertedRows;
      applied = true;
      insertedRows = this.performInsert(target, values, ignoreConflicts);
      return insertedRows;
    };

    const chain: {
      values: (input: TableRow | TableRow[]) => typeof chain;
      onConflictDoNothing: () => typeof chain;
      returning: (fields?: Record<string, { name: string }>) => Promise<TableRow[]>;
      then: <TResult1 = TableRow[], TResult2 = never>(
        onfulfilled?: ((value: TableRow[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise<TResult1 | TResult2>;
    } = {
      values: (input) => {
        values = Array.isArray(input) ? input : [input];
        return chain;
      },
      onConflictDoNothing: () => {
        ignoreConflicts = true;
        return chain;
      },
      returning: async (fieldsArg) => projectRows(applyInsert(), fieldsArg),
      then: (onfulfilled, onrejected) =>
        Promise.resolve(projectRows(applyInsert()) as TableRow[]).then(
          onfulfilled,
          onrejected
        ),
    };

    return chain;
  }

  update(table: unknown) {
    const target = tableName(table);
    let values: TableRow = {};
    const applyUpdate = () => {
      for (const row of this.state[target]) {
        Object.assign(row, values);
      }
      return this.state[target];
    };
    const chain = {
      set: (nextValues: TableRow) => {
        values = nextValues;
        return chain;
      },
      where: () => chain,
      returning: async (fields?: Record<string, { name: string }>) =>
        projectRows(applyUpdate(), fields),
    };
    return chain;
  }

  delete(table: unknown) {
    const target = tableName(table);
    const chain = {
      where: async () => {
        this.state[target] = [];
        return [];
      },
    };
    return chain;
  }

  private performInsert(
    target: keyof LifecycleState,
    values: TableRow[],
    ignoreConflicts: boolean
  ) {
    if (target === "reviewDecisions") {
      const inserted = values.map((value) => ({
        id: `decision-${this.reviewDecisionSeq++}`,
        decidedAt: NOW,
        note: null,
        ...value,
      }));
      this.state.reviewDecisions.push(...inserted);
      return inserted;
    }

    if (target === "deletionMarkers") {
      const inserted: TableRow[] = [];
      for (const value of values) {
        const exists = this.state.deletionMarkers.some(
          (row) =>
            row.projectId === value.projectId &&
            row.sourceId === value.sourceId &&
            row.externalId === value.externalId
        );
        if (exists) {
          if (ignoreConflicts) continue;
          throw new Error("deletion marker conflict");
        }
        const row = {
          id: `marker-${this.deletionMarkerSeq++}`,
          createdAt: NOW,
          ...value,
        };
        this.state.deletionMarkers.push(row);
        inserted.push(row);
      }
      return inserted;
    }

    if (target === "items" || target === "originalRecords") {
      this.state[target].push(...values);
      return values;
    }

    throw new Error(`unsupported insert target: ${target}`);
  }
}

class MockIngestDb {
  insertCalls = 0;
  sources: TableRow[];
  deletionMarkers: TableRow[];

  constructor(input: { sources?: TableRow[]; deletionMarkers?: TableRow[] }) {
    this.sources = input.sources ?? [];
    this.deletionMarkers = input.deletionMarkers ?? [];
  }

  select(fields?: Record<string, { name: string }>) {
    let rows: TableRow[] = [];
    const resolveRows = () => projectRows(rows, fields);
    const chain = {
      from: (table: unknown) => {
        if (table === schema.source) rows = this.sources;
        else if (table === schema.deletionMarker) rows = this.deletionMarkers;
        else rows = [];
        return chain;
      },
      where: () => chain,
      limit: async () => resolveRows(),
      then: <TResult1 = TableRow[], TResult2 = never>(
        onfulfilled?: ((value: TableRow[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(resolveRows() as TableRow[]).then(onfulfilled, onrejected),
    };
    return chain;
  }

  insert() {
    this.insertCalls += 1;
    const chain = {
      values: () => chain,
      returning: async () => [{ id: ITEM_ID }],
    };
    return chain;
  }
}

beforeEach(() => {
  Object.assign(itemRouteDeps as unknown as MutableDeps, originalItemRouteDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });
  Object.assign(ingestDeps as unknown as MutableDeps, originalIngestDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
    put: async () => ({ url: "https://blob.test/file" }),
    inngest: { send: async () => undefined },
  });
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, originalReviewOrDeletionDeps, {
    now: () => NOW,
  });
});

afterEach(() => {
  Object.assign(itemRouteDeps as unknown as MutableDeps, originalItemRouteDeps);
  Object.assign(ingestDeps as unknown as MutableDeps, originalIngestDeps);
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, originalReviewOrDeletionDeps);
});

test("trashDeleteAt keeps items recoverable for 30 days", () => {
  assert.equal(
    trashDeleteAt(new Date("2026-07-21T12:00:00.000Z")).toISOString(),
    "2026-08-20T12:00:00.000Z"
  );
});

test("applyReviewDecision reject moves review items to trash and records the decision", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "review",
        trashedAt: null,
        restoreStatus: null,
        sourceId: null,
        externalId: null,
        blobUrl: null,
      },
    ],
  });
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, { db });

  const result = await applyReviewDecision(
    USER_ID,
    PROJECT_ID,
    ITEM_ID,
    "reject",
    "off-topic"
  );

  assert.equal(result.item.status, "trashed");
  assert.equal(result.item.restoreStatus, "review");
  assert.equal(result.item.trashedAt?.toISOString(), NOW.toISOString());
  assert.equal(db.state.reviewDecisions.length, 1);
  assert.equal(db.state.reviewDecisions[0]?.decision, "reject");
  assert.equal(db.state.reviewDecisions[0]?.note, "off-topic");
});

test("applyReviewDecision approve re-enters the ingest pipeline as pending", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "review",
        trashedAt: null,
        restoreStatus: null,
        sourceId: null,
        externalId: null,
        blobUrl: null,
      },
    ],
  });
  const captured: string[] = [];
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, {
    db,
    sendItemCaptured: async (itemId: string) => {
      captured.push(itemId);
    },
  });

  const result = await applyReviewDecision(USER_ID, PROJECT_ID, ITEM_ID, "approve");

  assert.equal(result.item.status, "pending");
  assert.equal(result.item.restoreStatus, null);
  assert.equal(db.state.reviewDecisions[0]?.decision, "approve");
  // Approval, not rejection, is what re-triggers processing.
  assert.deepEqual(captured, [ITEM_ID]);
});

test("applyReviewDecision reject never re-enters the ingest pipeline", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "review",
        trashedAt: null,
        restoreStatus: null,
        sourceId: null,
        externalId: null,
        blobUrl: null,
      },
    ],
  });
  const captured: string[] = [];
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, {
    db,
    sendItemCaptured: async (itemId: string) => {
      captured.push(itemId);
    },
  });

  await applyReviewDecision(USER_ID, PROJECT_ID, ITEM_ID, "reject");

  assert.deepEqual(captured, []);
});

test("restoreItem returns a trashed item to its stored prior status", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "trashed",
        trashedAt: NOW,
        restoreStatus: "ready",
        sourceId: null,
        externalId: null,
        blobUrl: null,
      },
    ],
  });
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, { db });

  const result = await restoreItem(USER_ID, PROJECT_ID, ITEM_ID);

  assert.equal(result.item.status, "ready");
  assert.equal(result.item.trashedAt, null);
  assert.equal(result.item.restoreStatus, null);
});

test("permanentlyDeleteItem deletes the private blob, marker, originals, and item row", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "trashed",
        trashedAt: NOW,
        restoreStatus: "ready",
        sourceId: SOURCE_ID,
        externalId: "ext-1",
        blobUrl: "https://store.private.blob.vercel-storage.com/private.pdf",
      },
    ],
    originalRecords: [
      {
        id: "original-1",
        userId: USER_ID,
        projectId: PROJECT_ID,
        sourceId: SOURCE_ID,
        itemId: ITEM_ID,
        externalId: "ext-1",
      },
    ],
  });
  const deletedBlobUrls: string[] = [];
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, {
    db,
    deleteBlobIfPresent: async (blobUrl: string | null) => {
      if (blobUrl) deletedBlobUrls.push(blobUrl);
      return true;
    },
  });

  const result = await permanentlyDeleteItem(USER_ID, PROJECT_ID, ITEM_ID);

  assert.equal(result.itemId, ITEM_ID);
  assert.equal(result.blobDeleted, true);
  assert.equal(result.markerWritten, true);
  assert.deepEqual(deletedBlobUrls, [
    "https://store.private.blob.vercel-storage.com/private.pdf",
  ]);
  assert.equal(db.state.items.length, 0);
  assert.equal(db.state.originalRecords.length, 0);
  assert.equal(db.state.deletionMarkers.length, 1);
  assert.equal(db.state.deletionMarkers[0]?.sourceId, SOURCE_ID);
  assert.equal(db.state.deletionMarkers[0]?.externalId, "ext-1");
});

test("permanentlyDeleteItem rejects items outside the trash", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "ready",
        trashedAt: null,
        restoreStatus: null,
        sourceId: null,
        externalId: null,
        blobUrl: null,
      },
    ],
  });
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, { db });

  await assert.rejects(
    () => permanentlyDeleteItem(USER_ID, PROJECT_ID, ITEM_ID),
    InvalidItemStateError
  );
});

test("permanentlyDeleteItem does not delete the blob when the database transaction fails", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "trashed",
        trashedAt: NOW,
        restoreStatus: "ready",
        sourceId: SOURCE_ID,
        externalId: "ext-1",
        blobUrl: "https://store.private.blob.vercel-storage.com/private.pdf",
      },
    ],
  });
  db.failTransaction = true;

  let blobDeleteCalls = 0;
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, {
    db,
    deleteBlobIfPresent: async () => {
      blobDeleteCalls += 1;
      return true;
    },
  });

  await assert.rejects(
    () => permanentlyDeleteItem(USER_ID, PROJECT_ID, ITEM_ID),
    /transaction failed/
  );
  assert.equal(blobDeleteCalls, 0);
  assert.equal(db.state.items.length, 1);
});

test("permanentlyDeleteItem keeps a retryable deleting row when blob deletion fails", async () => {
  const db = new MockLifecycleDb({
    items: [
      {
        id: ITEM_ID,
        userId: USER_ID,
        projectId: PROJECT_ID,
        status: "trashed",
        trashedAt: NOW,
        restoreStatus: "ready",
        sourceId: SOURCE_ID,
        externalId: "ext-1",
        blobUrl: "https://store.private.blob.vercel-storage.com/private.pdf",
      },
    ],
  });
  let failBlobDelete = true;
  Object.assign(reviewOrDeletionDeps as unknown as MutableDeps, {
    db,
    deleteBlobIfPresent: async () => {
      if (failBlobDelete) throw new Error("blob unavailable");
      return true;
    },
  });

  await assert.rejects(
    () => permanentlyDeleteItem(USER_ID, PROJECT_ID, ITEM_ID),
    /blob unavailable/
  );
  assert.equal(db.state.items[0]?.status, "deleting");
  assert.equal(db.state.deletionMarkers.length, 1);

  failBlobDelete = false;
  const retried = await permanentlyDeleteItem(USER_ID, PROJECT_ID, ITEM_ID);
  assert.equal(retried.blobDeleted, true);
  assert.equal(db.state.items.length, 0);
});

test("GET /api/items/review requires explicit project scope", async () => {
  let listed = false;
  Object.assign(itemRouteDeps as unknown as MutableDeps, {
    listReviewItems: async () => {
      listed = true;
      return [];
    },
  });

  const response = await reviewGet(new NextRequest("http://localhost/api/items/review"));

  assert.equal(response.status, 400);
  assert.equal(listed, false);
});

test("POST /api/items/review applies a decision inside the explicit project scope", async () => {
  let receivedProjectId: unknown;
  Object.assign(itemRouteDeps as unknown as MutableDeps, {
    applyReviewDecision: async (
      _userId: string,
      projectId: string,
      itemId: string,
      decision: string,
      note: string | null
    ) => {
      receivedProjectId = projectId;
      return {
        item: {
          id: itemId,
          status: decision === "approve" ? "ready" : "trashed",
          trashedAt: null,
          restoreStatus: null,
        },
        decision: {
          id: "decision-1",
          decision,
          decidedAt: NOW,
          note,
        },
      };
    },
  });

  const response = await reviewPost(
    jsonRequest("/api/items/review", {
      projectId: PROJECT_ID,
      itemId: ITEM_ID,
      decision: "approve",
    })
  );

  assert.equal(response.status, 200);
  assert.equal(receivedProjectId, PROJECT_ID);
});

test("POST /api/items/trash rejects invalid explicit project scope before mutating", async () => {
  let moved = false;
  Object.assign(itemRouteDeps as unknown as MutableDeps, {
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    moveItemToTrash: async () => {
      moved = true;
      return { item: { id: ITEM_ID, status: "trashed", trashedAt: NOW, restoreStatus: "ready" } };
    },
  });

  const response = await trashPost(
    jsonRequest("/api/items/trash", { projectId: "bad-project", itemId: ITEM_ID })
  );

  assert.equal(response.status, 400);
  assert.equal(moved, false);
});

test("POST /api/items/[id]/restore requires explicit project scope", async () => {
  let restored = false;
  Object.assign(itemRouteDeps as unknown as MutableDeps, {
    restoreItem: async () => {
      restored = true;
      return { item: { id: ITEM_ID, status: "ready", trashedAt: null, restoreStatus: null } };
    },
  });

  const response = await restorePost(
    jsonRequest(`/api/items/${ITEM_ID}/restore`, {}),
    { params: Promise.resolve({ id: ITEM_ID }) }
  );

  assert.equal(response.status, 400);
  assert.equal(restored, false);
});

test("DELETE /api/items/[id] rejects invalid explicit project scope before deleting", async () => {
  let deleted = false;
  Object.assign(itemRouteDeps as unknown as MutableDeps, {
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    permanentlyDeleteItem: async () => {
      deleted = true;
      return { itemId: ITEM_ID, markerWritten: true, blobDeleted: true };
    },
  });

  const response = await itemDelete(
    new NextRequest(`http://localhost/api/items/${ITEM_ID}?projectId=bad-project`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: ITEM_ID }) }
  );

  assert.equal(response.status, 400);
  assert.equal(deleted, false);
});

for (const mode of ["json", "multipart"] as const) {
  test(`POST /api/ingest blocks deletion-marker reimport before side effects (${mode})`, async () => {
    const db = new MockIngestDb({
      sources: [{ id: SOURCE_ID, userId: USER_ID, projectId: PROJECT_ID }],
      deletionMarkers: [
        {
          id: "marker-1",
          userId: USER_ID,
          projectId: PROJECT_ID,
          sourceId: SOURCE_ID,
          externalId: "ext-1",
        },
      ],
    });

    let putCalls = 0;
    let sendCalls = 0;
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      put: async () => {
        putCalls += 1;
        return { url: "https://blob.test/file" };
      },
      inngest: {
        send: async () => {
          sendCalls += 1;
        },
      },
    });

    const request =
      mode === "json"
        ? jsonRequest("/api/ingest", {
            type: "text",
            text: "blocked",
            projectId: PROJECT_ID,
            sourceId: SOURCE_ID,
            externalId: "ext-1",
          })
        : fileRequest("/api/ingest", {
            projectId: PROJECT_ID,
            sourceId: SOURCE_ID,
            externalId: "ext-1",
          });

    const response = await ingestPost(request);

    assert.equal(response.status, 409);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });
}
