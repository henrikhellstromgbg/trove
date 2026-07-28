import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as capturePost } from "@/app/api/capture/route";
import { captureDeps } from "@/app/api/capture/deps";
import { POST as ingestPost } from "@/app/api/ingest/route";
import { ingestDeps } from "@/app/api/ingest/deps";
import { POST as askPost } from "@/app/api/ask/route";
import { askDeps } from "@/app/api/ask/deps";
import { InvalidProjectError, isUuid, verifyProjectOwnership } from "@/lib/projects";
import {
  InvalidSourceError,
  LockedProjectError,
  enforceTokenLock,
  verifySourceOwnership,
} from "@/lib/ingest-validation";

const USER_ID = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const SOURCE_A = "33333333-3333-4333-8333-333333333333";

type MutableDeps = Record<string, unknown>;

const originalCaptureDeps = { ...captureDeps };
const originalIngestDeps = { ...ingestDeps };
const originalAskDeps = { ...askDeps };

class MockDb {
  insertCalls = 0;
  insertValues: Array<Record<string, unknown>> = [];
  selectResults: unknown[][] = [];

  select() {
    const rows = this.selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
    };
    return chain;
  }

  insert() {
    this.insertCalls += 1;
    const chain = {
      values: (values: Record<string, unknown>) => {
        this.insertValues.push(values);
        return chain;
      },
      returning: async () => [{ id: "item-1" }],
    };
    return chain;
  }
}

let putCalls = 0;
let sendCalls = 0;
let putInputs: unknown[][] = [];

beforeEach(() => {
  putCalls = 0;
  sendCalls = 0;
  putInputs = [];

  Object.assign(captureDeps as unknown as MutableDeps, originalCaptureDeps, {
    auth: async () => ({ userId: USER_ID }),
    storeUpload: async (...args: unknown[]) => {
      putCalls += 1;
      putInputs.push(args);
      return { key: "stored-file-key" };
    },
    inngest: {
      send: async () => {
        sendCalls += 1;
      },
    },
  });
  Object.assign(ingestDeps as unknown as MutableDeps, originalIngestDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    storeUpload: async (...args: unknown[]) => {
      putCalls += 1;
      putInputs.push(args);
      return { key: "stored-file-key" };
    },
    inngest: {
      send: async () => {
        sendCalls += 1;
      },
    },
  });
  Object.assign(askDeps as unknown as MutableDeps, originalAskDeps, {
    auth: async () => ({ userId: USER_ID }),
  });
});

afterEach(() => {
  Object.assign(captureDeps as unknown as MutableDeps, originalCaptureDeps);
  Object.assign(ingestDeps as unknown as MutableDeps, originalIngestDeps);
  Object.assign(askDeps as unknown as MutableDeps, originalAskDeps);
});

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fileRequest(path: string, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: form });
}

function ingestRequest(
  mode: "json" | "multipart",
  fields: Record<string, unknown> = {}
) {
  if (mode === "json") {
    return jsonRequest("/api/ingest", { type: "text", text: "hello", ...fields });
  }
  return fileRequest(
    "/api/ingest",
    Object.fromEntries(
      Object.entries(fields)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  );
}

test("browser JSON capture uses the ingest contract", async () => {
  const db = new MockDb();
  Object.assign(ingestDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });

  const response = await ingestPost(
    jsonRequest("/api/ingest", {
      type: "text",
      text: "A saved thought",
      projectId: PROJECT_A,
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(db.insertValues[0], {
    userId: USER_ID,
    projectId: PROJECT_A,
    sourceId: null,
    externalId: null,
    type: "text",
    rawText: "A saved thought",
    source: null,
    status: "pending",
  });
  assert.equal(putCalls, 0);
  assert.equal(sendCalls, 1);
});

test("browser file capture uses multipart bytes through ingest", async () => {
  const db = new MockDb();
  Object.assign(ingestDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });

  const response = await ingestPost(fileRequest("/api/ingest", {
    projectId: PROJECT_A,
  }));

  assert.equal(response.status, 200);
  assert.equal(putCalls, 1);
  assert.equal(sendCalls, 1);
  // storeUpload is called with (originalName, bytes).
  assert.equal(putInputs[0]?.[0], "note.txt");
  const uploadedBytes = putInputs[0]?.[1] as Buffer;
  assert.equal(Buffer.isBuffer(uploadedBytes), true);
  assert.equal(uploadedBytes.toString("utf-8"), "hello");
  assert.deepEqual(db.insertValues[0], {
    userId: USER_ID,
    projectId: PROJECT_A,
    sourceId: null,
    externalId: null,
    type: "textfile",
    blobUrl: "stored-file-key",
    source: "note.txt",
    status: "pending",
  });
});

test("browser file capture reports an existing project filename before side effects", async () => {
  const db = new MockDb();
  db.selectResults.push([{ id: "existing-item", status: "ready" }]);
  Object.assign(ingestDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });

  const response = await ingestPost(fileRequest("/api/ingest", {
    projectId: PROJECT_A,
  }));

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "File already exists",
    id: "existing-item",
    status: "ready",
    duplicate: true,
  });
  assert.equal(db.insertCalls, 0);
  assert.equal(putCalls, 0);
  assert.equal(sendCalls, 0);
});

// Backed by the REAL ownership helper: the fetched row belongs to user-b, so
// the rejection comes from verifyProjectOwnership's own comparisons, not from
// a mock that throws unconditionally.
async function foreignOwnedRequireProjectId(userId: string, provided: unknown) {
  if (!isUuid(provided)) throw new InvalidProjectError();
  return verifyProjectOwnership(userId, provided, { id: provided, userId: "user-b" });
}

for (const mode of ["json", "multipart"] as const) {
  test(`capture rejects invalid project (${mode}) without creating an item`, async () => {
    const db = new MockDb();
    Object.assign(captureDeps as unknown as MutableDeps, {
      db,
      requireProjectId: foreignOwnedRequireProjectId,
    });

    const req =
      mode === "json"
        ? jsonRequest("/api/capture", {
            type: "text",
            content: "hello",
            projectId: PROJECT_B,
          })
        : fileRequest("/api/capture", { projectId: PROJECT_B });
    const response = await capturePost(req);

    assert.equal(response.status, 400);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  test(`capture rejects malformed project UUID (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(captureDeps as unknown as MutableDeps, {
      db,
      requireProjectId: (_userId: string, projectId: unknown) => {
        if (!isUuid(projectId)) throw new InvalidProjectError();
        return Promise.resolve(projectId);
      },
    });

    const req =
      mode === "json"
        ? jsonRequest("/api/capture", {
            type: "text",
            content: "hello",
            projectId: "not-a-uuid",
          })
        : fileRequest("/api/capture", { projectId: "not-a-uuid" });
    const response = await capturePost(req);

    assert.equal(response.status, 400);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  test(`ingest rejects invalid project (${mode}) without side effects`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      requireProjectId: foreignOwnedRequireProjectId,
    });

    const response = await ingestPost(ingestRequest(mode, { projectId: PROJECT_B }));

    assert.equal(response.status, 400);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  test(`ingest rejects malformed project UUID (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, { db });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: "not-a-uuid" })
    );

    assert.equal(response.status, 400);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  test(`ingest rejects malformed source UUID (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      requireProjectId: async () => PROJECT_A,
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_A, sourceId: "not-a-uuid" })
    );

    assert.equal(response.status, 400);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  // The mocked select returns a REAL source row; the rejection must come
  // from verifySourceOwnership comparing owner and project, so these tests
  // fail if either comparison is removed.
  const rejectedSourceRows = {
    "another user's source": { id: SOURCE_A, userId: "user-b", projectId: PROJECT_A },
    "own source in another project": { id: SOURCE_A, userId: USER_ID, projectId: PROJECT_B },
  } as const;
  for (const [scenario, sourceRow] of Object.entries(rejectedSourceRows)) {
    test(`ingest rejects ${scenario} (${mode})`, async () => {
      const db = new MockDb();
      db.selectResults.push([sourceRow]);
      Object.assign(ingestDeps as unknown as MutableDeps, {
        db,
        requireProjectId: async () => PROJECT_A,
      });

      const response = await ingestPost(
        ingestRequest(mode, { projectId: PROJECT_A, sourceId: SOURCE_A })
      );

      assert.equal(response.status, 400);
      assert.equal(db.insertCalls, 0);
      assert.equal(putCalls, 0);
      assert.equal(sendCalls, 0);
    });
  }

  test(`locked token without project uses its locked project (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      resolveIngestAuth: async () => ({
        userId: USER_ID,
        lockedProjectId: PROJECT_A,
      }),
      requireProjectId: async (_userId: string, projectId: unknown) => projectId,
    });

    const response = await ingestPost(ingestRequest(mode));

    assert.equal(response.status, 200);
    assert.equal(db.insertValues[0]?.projectId, PROJECT_A);
  });

  test(`locked token accepts its own project in mixed case (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      resolveIngestAuth: async () => ({
        userId: USER_ID,
        lockedProjectId: PROJECT_A,
      }),
      requireProjectId: async (_userId: string, projectId: unknown) => projectId,
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_A.toUpperCase() })
    );

    assert.equal(response.status, 200);
    assert.equal(db.insertValues[0]?.projectId, PROJECT_A);
  });

  test(`locked token rejects a different project (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      resolveIngestAuth: async () => ({
        userId: USER_ID,
        lockedProjectId: PROJECT_A,
      }),
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_B })
    );

    assert.equal(response.status, 403);
    assert.equal(db.insertCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(sendCalls, 0);
  });

  test(`unlocked token accepts a valid owned project (${mode})`, async () => {
    const db = new MockDb();
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      requireProjectId: async (_userId: string, projectId: unknown) => projectId,
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_B })
    );

    assert.equal(response.status, 200);
    assert.equal(db.insertValues[0]?.projectId, PROJECT_B);
  });

  test(`an active review rule holds source-attributed items without emitting (${mode})`, async () => {
    const db = new MockDb();
    db.selectResults.push([{ id: SOURCE_A, userId: USER_ID, projectId: PROJECT_A }]);
    let ruleLookups = 0;
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      requireProjectId: async (_userId: string, projectId: unknown) => projectId,
      loadReviewRuleConfig: async () => {
        ruleLookups += 1;
        return { mode: "all", contains: [] };
      },
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_A, sourceId: SOURCE_A })
    );

    assert.equal(response.status, 200);
    assert.equal(ruleLookups, 1);
    assert.equal(db.insertValues[0]?.status, "review");
    // Held items must never enter the ingest pipeline.
    assert.equal(sendCalls, 0);
    assert.equal((await response.json()).status, "review");
  });

  test(`no review rule lets source-attributed items flow to pending and emit (${mode})`, async () => {
    const db = new MockDb();
    db.selectResults.push([{ id: SOURCE_A, userId: USER_ID, projectId: PROJECT_A }]);
    Object.assign(ingestDeps as unknown as MutableDeps, {
      db,
      requireProjectId: async (_userId: string, projectId: unknown) => projectId,
      loadReviewRuleConfig: async () => null,
    });

    const response = await ingestPost(
      ingestRequest(mode, { projectId: PROJECT_A, sourceId: SOURCE_A })
    );

    assert.equal(response.status, 200);
    assert.equal(db.insertValues[0]?.status, "pending");
    assert.equal(sendCalls, 1);
  });
}

test("ask requires projectId", async () => {
  const response = await askPost(
    jsonRequest("/api/ask", { question: "What did I save?" })
  );
  assert.equal(response.status, 400);
});

test("ask persists a new project conversation and its empty-corpus answer", async () => {
  const db = new MockDb();
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
    embedQuery: async () => Array.from({ length: 768 }, () => 0),
  });

  const response = await askPost(
    jsonRequest("/api/ask", {
      question: "What did I save?",
      projectId: PROJECT_A,
    })
  );
  const streamed = await response.text();

  assert.equal(response.status, 200);
  assert.match(streamed, /"type":"answer","id":"item-1"/);
  assert.match(streamed, /I don't have anything saved on that yet\./);
  assert.deepEqual(db.insertValues, [
    {
      userId: USER_ID,
      projectId: PROJECT_A,
      title: "What did I save?",
    },
    {
      conversationId: "item-1",
      role: "user",
      content: "What did I save?",
    },
    {
      conversationId: "item-1",
      role: "assistant",
      content: "I don't have anything saved on that yet.",
      citations: [],
    },
  ]);
});

test("ask rejects a conversation outside the active project", async () => {
  const db = new MockDb();
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async () => PROJECT_A,
  });

  const response = await askPost(
    jsonRequest("/api/ask", {
      question: "Continue",
      projectId: PROJECT_A,
      conversationId: PROJECT_B,
    })
  );

  assert.equal(response.status, 400);
  assert.equal(db.insertCalls, 0);
});

for (const scenario of ["malformed", "another user's"] as const) {
  test(`ask rejects ${scenario} projectId`, async () => {
    Object.assign(askDeps as unknown as MutableDeps, {
      requireProjectId: foreignOwnedRequireProjectId,
    });
    const response = await askPost(
      jsonRequest("/api/ask", {
        question: "What did I save?",
        projectId: scenario === "malformed" ? "not-a-uuid" : PROJECT_B,
      })
    );
    assert.equal(response.status, 400);
  });
}

// Unit tests for the real ownership helpers, fed real rows. These are the
// tests that fail if an owner or project comparison is removed.

test("verifyProjectOwnership accepts the owner's row, case-insensitively", () => {
  assert.equal(
    verifyProjectOwnership(USER_ID, PROJECT_A.toUpperCase(), {
      id: PROJECT_A,
      userId: USER_ID,
    }),
    PROJECT_A
  );
});

test("verifyProjectOwnership rejects a foreign owner's row", () => {
  assert.throws(
    () => verifyProjectOwnership(USER_ID, PROJECT_A, { id: PROJECT_A, userId: "user-b" }),
    InvalidProjectError
  );
});

test("verifyProjectOwnership rejects a row for a different project", () => {
  assert.throws(
    () => verifyProjectOwnership(USER_ID, PROJECT_A, { id: PROJECT_B, userId: USER_ID }),
    InvalidProjectError
  );
});

test("verifyProjectOwnership rejects a missing row", () => {
  assert.throws(() => verifyProjectOwnership(USER_ID, PROJECT_A, undefined), InvalidProjectError);
});

test("verifySourceOwnership accepts a matching row, case-insensitively", () => {
  assert.equal(
    verifySourceOwnership(USER_ID, PROJECT_A.toUpperCase(), {
      id: SOURCE_A,
      userId: USER_ID,
      projectId: PROJECT_A,
    }),
    SOURCE_A
  );
});

test("verifySourceOwnership rejects a foreign owner's source", () => {
  assert.throws(
    () =>
      verifySourceOwnership(USER_ID, PROJECT_A, {
        id: SOURCE_A,
        userId: "user-b",
        projectId: PROJECT_A,
      }),
    InvalidSourceError
  );
});

test("verifySourceOwnership rejects an own source in another project", () => {
  assert.throws(
    () =>
      verifySourceOwnership(USER_ID, PROJECT_A, {
        id: SOURCE_A,
        userId: USER_ID,
        projectId: PROJECT_B,
      }),
    InvalidSourceError
  );
});

test("verifySourceOwnership rejects a missing row", () => {
  assert.throws(() => verifySourceOwnership(USER_ID, PROJECT_A, undefined), InvalidSourceError);
});

test("enforceTokenLock allows the locked project in any case", () => {
  assert.doesNotThrow(() => enforceTokenLock(PROJECT_A, PROJECT_A.toUpperCase()));
  assert.doesNotThrow(() => enforceTokenLock(PROJECT_A, undefined));
  assert.doesNotThrow(() => enforceTokenLock(null, PROJECT_B));
});

test("enforceTokenLock rejects any other project", () => {
  assert.throws(() => enforceTokenLock(PROJECT_A, PROJECT_B), LockedProjectError);
});
