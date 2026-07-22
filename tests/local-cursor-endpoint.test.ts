import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as cursorPost } from "@/app/api/sources/local/cursor/route";
import { localCursorRouteDeps } from "@/app/api/sources/local/cursor/deps";
import { InvalidSourceError } from "@/lib/sources/contracts";

type MutableDeps = Record<string, unknown>;

const USER_ID = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";

const originalDeps = { ...localCursorRouteDeps };
afterEach(() => {
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, originalDeps);
});

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/sources/local/cursor", {
    method: "POST",
    body: body === undefined ? "not json" : JSON.stringify(body),
  });
}

test("POST requires a valid token or session", async () => {
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => null,
  });
  const res = await cursorPost(req({ sourceId: SOURCE_ID, cursor: { v: 1 } }));
  assert.equal(res.status, 401);
});

test("a missing sourceId is rejected before any write", async () => {
  let called = false;
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    updateLocalSourceCursor: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });
  const res = await cursorPost(req({ cursor: { v: 1 } }));
  assert.equal(res.status, 400);
  assert.equal(called, false);
});

test("a missing cursor field is rejected", async () => {
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    updateLocalSourceCursor: async () => {
      throw new Error("should not be called");
    },
  });
  const res = await cursorPost(req({ sourceId: SOURCE_ID }));
  assert.equal(res.status, 400);
});

test("malformed JSON is rejected", async () => {
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
  });
  const res = await cursorPost(req());
  assert.equal(res.status, 400);
});

test("a locked token scopes the update to its project and passes the cursor through", async () => {
  let passed: { userId?: string; sourceId?: string; cursor?: unknown; locked?: unknown } = {};
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: PROJECT_A }),
    updateLocalSourceCursor: async (
      userId: string,
      sourceId: string,
      cursor: unknown,
      locked?: string | null
    ) => {
      passed = { userId, sourceId, cursor, locked };
      return { id: sourceId, cursor };
    },
  });

  const cursor = { sent: ["a@x"], version: 2 };
  const res = await cursorPost(req({ sourceId: SOURCE_ID, cursor }));
  const jsonBody = await res.json();

  assert.equal(res.status, 200);
  assert.equal(passed.userId, USER_ID);
  assert.equal(passed.sourceId, SOURCE_ID);
  assert.equal(passed.locked, PROJECT_A);
  assert.deepEqual(passed.cursor, cursor);
  assert.deepEqual(jsonBody.cursor, cursor);
});

test("a source the token does not own is a 404", async () => {
  Object.assign(localCursorRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    updateLocalSourceCursor: async () => {
      throw new InvalidSourceError();
    },
  });
  const res = await cursorPost(req({ sourceId: SOURCE_ID, cursor: { v: 1 } }));
  assert.equal(res.status, 404);
});
