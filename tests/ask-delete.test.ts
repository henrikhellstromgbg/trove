import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { DELETE as askDelete } from "@/app/api/ask/route";
import { askDeps } from "@/app/api/ask/deps";
import { InvalidProjectError } from "@/lib/projects";

const USER_ID = "user-a";
const OTHER_USER_ID = "user-b";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

type MutableDeps = Record<string, unknown>;

const originalAskDeps = { ...askDeps };

// Minimal db: select() feeds the ownership lookup, delete() records that a delete
// was actually issued so tests can assert the refused paths write nothing.
class AskDb {
  selectResults: unknown[][] = [];
  deletes = 0;

  select() {
    const rows = this.selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => rows,
    };
    return chain;
  }

  delete() {
    return {
      where: async () => {
        this.deletes++;
        return [];
      },
    };
  }
}

function deleteRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/ask");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url, { method: "DELETE" });
}

beforeEach(() => {
  Object.assign(askDeps as unknown as MutableDeps, originalAskDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async () => PROJECT_ID,
  });
});

afterEach(() => {
  Object.assign(askDeps as unknown as MutableDeps, originalAskDeps);
});

test("deletes an owned conversation and reports its id", async () => {
  const db = new AskDb();
  db.selectResults.push([
    { id: CONVERSATION_ID, userId: USER_ID, projectId: PROJECT_ID },
  ]);
  Object.assign(askDeps as unknown as MutableDeps, { db });

  const response = await askDelete(
    deleteRequest({ conversationId: CONVERSATION_ID, projectId: PROJECT_ID })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: CONVERSATION_ID });
  assert.equal(db.deletes, 1);
});

for (const scenario of [
  {
    name: "a foreign user's conversation",
    row: { id: CONVERSATION_ID, userId: OTHER_USER_ID, projectId: PROJECT_ID },
  },
  {
    name: "a conversation in another project",
    row: { id: CONVERSATION_ID, userId: USER_ID, projectId: OTHER_PROJECT_ID },
  },
] as const) {
  test(`refuses to delete ${scenario.name} (404, nothing deleted)`, async () => {
    const db = new AskDb();
    db.selectResults.push([scenario.row]);
    Object.assign(askDeps as unknown as MutableDeps, { db });

    const response = await askDelete(
      deleteRequest({ conversationId: CONVERSATION_ID, projectId: PROJECT_ID })
    );

    assert.equal(response.status, 404);
    assert.equal(db.deletes, 0);
  });
}

test("a non-uuid conversationId is a 404 before any query", async () => {
  const db = new AskDb();
  Object.assign(askDeps as unknown as MutableDeps, { db });

  const response = await askDelete(
    deleteRequest({ conversationId: "not-a-uuid", projectId: PROJECT_ID })
  );

  assert.equal(response.status, 404);
  assert.equal(db.deletes, 0);
});

test("a missing conversationId is a 404, nothing deleted", async () => {
  const db = new AskDb();
  Object.assign(askDeps as unknown as MutableDeps, { db });

  const response = await askDelete(deleteRequest({ projectId: PROJECT_ID }));

  assert.equal(response.status, 404);
  assert.equal(db.deletes, 0);
});

test("an unowned/invalid project is a 400, nothing deleted", async () => {
  const db = new AskDb();
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    requireProjectId: async () => {
      throw new InvalidProjectError("nope");
    },
  });

  const response = await askDelete(
    deleteRequest({ conversationId: CONVERSATION_ID, projectId: OTHER_PROJECT_ID })
  );

  assert.equal(response.status, 400);
  assert.equal(db.deletes, 0);
});

test("an unauthenticated request is a 401", async () => {
  const db = new AskDb();
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    auth: async () => ({ userId: null }),
  });

  const response = await askDelete(
    deleteRequest({ conversationId: CONVERSATION_ID, projectId: PROJECT_ID })
  );

  assert.equal(response.status, 401);
  assert.equal(db.deletes, 0);
});
