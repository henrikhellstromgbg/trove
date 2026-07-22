import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET as tokensGet, POST as tokensPost } from "@/app/api/ingest-tokens/route";
import { DELETE as tokenDelete } from "@/app/api/ingest-tokens/[id]/route";
import { ingestTokenRouteDeps } from "@/app/api/ingest-tokens/deps";
import {
  createIngestToken,
  ingestTokenDeps,
  listIngestTokens,
  revokeIngestToken,
} from "@/lib/ingest-tokens";
import { hashIngestToken } from "@/lib/ingest-auth";
import { InvalidProjectError } from "@/lib/projects";

type MutableDeps = Record<string, unknown>;

const USER_ID = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-07-22T10:00:00.000Z");

const originalTokenDeps = { ...ingestTokenDeps };
const originalRouteDeps = { ...ingestTokenRouteDeps };

afterEach(() => {
  Object.assign(ingestTokenDeps as unknown as MutableDeps, originalTokenDeps);
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, originalRouteDeps);
});

// --- store ---

class CapturingDb {
  insertValues: Record<string, unknown>[] = [];
  updateCalls = 0;
  selectResults: unknown[][] = [];
  insertReturn: unknown[] = [{ id: TOKEN_ID, projectId: null, label: null, createdAt: NOW }];
  updateReturn: unknown[] = [{ id: TOKEN_ID, revokedAt: NOW }];

  select() {
    const rows = this.selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (res: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(res),
    };
    return chain;
  }

  insert() {
    const chain = {
      values: (values: Record<string, unknown>) => {
        this.insertValues.push(values);
        return chain;
      },
      returning: async () => this.insertReturn,
    };
    return chain;
  }

  update() {
    this.updateCalls += 1;
    const chain = {
      set: () => chain,
      where: () => chain,
      returning: async () => this.updateReturn,
    };
    return chain;
  }
}

test("createIngestToken stores only the hash and returns the plaintext once", async () => {
  const db = new CapturingDb();
  db.insertReturn = [{ id: TOKEN_ID, projectId: PROJECT_A, label: "laptop", createdAt: NOW }];
  Object.assign(ingestTokenDeps as unknown as MutableDeps, {
    db,
    generateToken: () => "trove_PLAINTEXT",
  });

  const created = await createIngestToken(USER_ID, { projectId: PROJECT_A, label: "laptop" });

  assert.equal(created.token, "trove_PLAINTEXT");
  assert.equal(created.projectId, PROJECT_A);
  assert.equal(created.label, "laptop");
  // The row persists the hash, never the plaintext.
  assert.equal(db.insertValues[0]?.tokenHash, hashIngestToken("trove_PLAINTEXT"));
  assert.notEqual(db.insertValues[0]?.tokenHash, "trove_PLAINTEXT");
  assert.equal(db.insertValues[0]?.userId, USER_ID);
  assert.equal(db.insertValues[0]?.projectId, PROJECT_A);
});

test("listIngestTokens returns summaries without the hash", async () => {
  const db = new CapturingDb();
  db.selectResults = [
    [{ id: TOKEN_ID, label: "laptop", projectId: PROJECT_A, createdAt: NOW, revokedAt: null }],
  ];
  Object.assign(ingestTokenDeps as unknown as MutableDeps, { db });

  const tokens = await listIngestTokens(USER_ID);

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].id, TOKEN_ID);
  assert.ok(!("tokenHash" in tokens[0]));
  assert.ok(!("token" in tokens[0]));
});

test("revokeIngestToken refuses another user's token and never updates", async () => {
  const db = new CapturingDb();
  db.selectResults = [[{ id: TOKEN_ID, userId: "user-b", revokedAt: null }]];
  Object.assign(ingestTokenDeps as unknown as MutableDeps, { db });

  await assert.rejects(() => revokeIngestToken(USER_ID, TOKEN_ID), /Invalid tokenId/);
  assert.equal(db.updateCalls, 0);
});

test("revokeIngestToken marks the owner's token revoked", async () => {
  const db = new CapturingDb();
  db.selectResults = [[{ id: TOKEN_ID, userId: USER_ID, revokedAt: null }]];
  Object.assign(ingestTokenDeps as unknown as MutableDeps, { db, now: () => NOW });

  const result = await revokeIngestToken(USER_ID, TOKEN_ID);

  assert.equal(result.id, TOKEN_ID);
  assert.equal(result.revokedAt, NOW);
  assert.equal(db.updateCalls, 1);
});

test("revokeIngestToken is idempotent on an already-revoked token", async () => {
  const db = new CapturingDb();
  const earlier = new Date("2026-07-01T00:00:00.000Z");
  db.selectResults = [[{ id: TOKEN_ID, userId: USER_ID, revokedAt: earlier }]];
  Object.assign(ingestTokenDeps as unknown as MutableDeps, { db });

  const result = await revokeIngestToken(USER_ID, TOKEN_ID);

  assert.equal(result.revokedAt, earlier);
  assert.equal(db.updateCalls, 0);
});

test("revokeIngestToken rejects a malformed id", async () => {
  const db = new CapturingDb();
  Object.assign(ingestTokenDeps as unknown as MutableDeps, { db });
  await assert.rejects(() => revokeIngestToken(USER_ID, "not-a-uuid"), /Invalid tokenId/);
  assert.equal(db.selectResults.length, 0);
});

// --- routes ---

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/ingest-tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST rejects a foreign/invalid project without minting a token", async () => {
  let created = 0;
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    createIngestToken: async () => {
      created += 1;
      return {};
    },
  });

  const res = await tokensPost(jsonRequest({ projectId: PROJECT_A }));
  assert.equal(res.status, 400);
  assert.equal(created, 0);
});

test("POST with a valid owned project mints a locked token", async () => {
  let passedProjectId: unknown = "unset";
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_u: string, p: unknown) => p,
    createIngestToken: async (_u: string, input: { projectId: string | null }) => {
      passedProjectId = input.projectId;
      return { token: "trove_X", id: TOKEN_ID, projectId: input.projectId, label: null, createdAt: NOW };
    },
  });

  const res = await tokensPost(jsonRequest({ projectId: PROJECT_A }));
  assert.equal(res.status, 200);
  assert.equal(passedProjectId, PROJECT_A);
  assert.equal((await res.json()).token, "trove_X");
});

test("POST without a project mints an unlocked token", async () => {
  let passedProjectId: unknown = "unset";
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    createIngestToken: async (_u: string, input: { projectId: string | null }) => {
      passedProjectId = input.projectId;
      return { token: "trove_Y", id: TOKEN_ID, projectId: null, label: null, createdAt: NOW };
    },
  });

  const res = await tokensPost(jsonRequest({}));
  assert.equal(res.status, 200);
  assert.equal(passedProjectId, null);
});

test("GET and POST require authentication", async () => {
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: null }),
  });
  assert.equal((await tokensGet()).status, 401);
  assert.equal((await tokensPost(jsonRequest({}))).status, 401);
});

test("DELETE maps a foreign/missing token to 404", async () => {
  const { InvalidIngestTokenError } = await import("@/lib/ingest-tokens");
  Object.assign(ingestTokenRouteDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    revokeIngestToken: async () => {
      throw new InvalidIngestTokenError();
    },
  });

  const res = await tokenDelete(
    new NextRequest("http://localhost/api/ingest-tokens/x", { method: "DELETE" }),
    { params: Promise.resolve({ id: TOKEN_ID }) }
  );
  assert.equal(res.status, 404);
});
