import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import {
  POST as askPost,
  verifyConversationOwnership,
} from "@/app/api/ask/route";
import { askDeps } from "@/app/api/ask/deps";

const USER_ID = "user-a";
const OTHER_USER_ID = "user-b";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

type MutableDeps = Record<string, unknown>;

const originalAskDeps = { ...askDeps };

class AskDb {
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
    const chain = {
      values: (values: Record<string, unknown>) => {
        this.insertValues.push(values);
        return chain;
      },
      returning: async () => [{ id: CONVERSATION_ID }],
    };
    return chain;
  }
}

function askRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function records(body: string) {
  return body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
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

test("conversation ownership accepts the exact owned row", () => {
  assert.equal(
    verifyConversationOwnership(USER_ID, PROJECT_ID, CONVERSATION_ID, {
      id: CONVERSATION_ID,
      userId: USER_ID,
      projectId: PROJECT_ID,
    }),
    CONVERSATION_ID
  );
});

test("conversation ownership rejects a foreign user's real row", () => {
  assert.equal(
    verifyConversationOwnership(USER_ID, PROJECT_ID, CONVERSATION_ID, {
      id: CONVERSATION_ID,
      userId: OTHER_USER_ID,
      projectId: PROJECT_ID,
    }),
    null
  );
});

test("conversation ownership rejects a real row from another project", () => {
  assert.equal(
    verifyConversationOwnership(USER_ID, PROJECT_ID, CONVERSATION_ID, {
      id: CONVERSATION_ID,
      userId: USER_ID,
      projectId: OTHER_PROJECT_ID,
    }),
    null
  );
});

for (const scenario of [
  {
    name: "foreign user",
    row: {
      id: CONVERSATION_ID,
      userId: OTHER_USER_ID,
      projectId: PROJECT_ID,
    },
  },
  {
    name: "wrong project",
    row: {
      id: CONVERSATION_ID,
      userId: USER_ID,
      projectId: OTHER_PROJECT_ID,
    },
  },
] as const) {
  test(`Ask route rejects a conversation owned by ${scenario.name}`, async () => {
    const db = new AskDb();
    db.selectResults.push([scenario.row]);
    Object.assign(askDeps as unknown as MutableDeps, { db });

    const response = await askPost(
      askRequest({
        question: "Continue",
        projectId: PROJECT_ID,
        conversationId: CONVERSATION_ID,
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid conversationId" });
    assert.deepEqual(db.insertValues, []);
  });
}

test("embedding failure returns a stable retryable stream error", async () => {
  const db = new AskDb();
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    embedQuery: async () => {
      throw new Error("secret embedding provider failure");
    },
  });

  const response = await askPost(
    askRequest({ question: "What did I save?", projectId: PROJECT_ID })
  );
  const streamed = records(await response.text());

  assert.equal(response.status, 200);
  assert.deepEqual(streamed, [
    { type: "conversation", id: CONVERSATION_ID },
    {
      type: "error",
      code: "ASK_EMBEDDING_FAILED",
      error: "Unable to answer right now. Try again.",
      retryable: true,
    },
    { type: "done" },
  ]);
  assert.doesNotMatch(JSON.stringify(streamed), /secret embedding provider failure/);
  assert.deepEqual(db.insertValues, [
    {
      userId: USER_ID,
      projectId: PROJECT_ID,
      title: "What did I save?",
    },
    {
      conversationId: CONVERSATION_ID,
      role: "user",
      content: "What did I save?",
    },
  ]);
});

test("AI stream failure returns a stable retryable error and saves no partial answer", async () => {
  const db = new AskDb();
  db.selectResults.push([
    {
      chunkText: "Saved evidence",
      itemId: "44444444-4444-4444-8444-444444444444",
      title: "Evidence",
      source: null,
    },
  ]);
  Object.assign(askDeps as unknown as MutableDeps, {
    db,
    embedQuery: async () => Array.from({ length: 768 }, () => 0),
    anthropic: {
      messages: {
        stream: () => ({
          on: (_event: string, callback: (delta: string) => void) => {
            callback("Partial answer");
          },
          finalMessage: async () => {
            throw new Error("secret AI stream failure");
          },
        }),
      },
    },
  });

  const response = await askPost(
    askRequest({ question: "What did I save?", projectId: PROJECT_ID })
  );
  const streamed = records(await response.text());

  assert.equal(response.status, 200);
  assert.deepEqual(streamed.at(-2), {
    type: "error",
    code: "ASK_GENERATION_FAILED",
    error: "Unable to answer right now. Try again.",
    retryable: true,
  });
  assert.deepEqual(streamed.at(-1), { type: "done" });
  assert.doesNotMatch(JSON.stringify(streamed), /secret AI stream failure/);
  assert.equal(
    db.insertValues.some((value) => value.role === "assistant"),
    false
  );
});
