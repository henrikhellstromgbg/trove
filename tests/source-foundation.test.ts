import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET as sourceGet, PATCH as sourcePatch } from "@/app/api/sources/[id]/route";
import { DELETE as sourceDelete } from "@/app/api/sources/[id]/route";
import { POST as sourceRulePost } from "@/app/api/sources/[id]/rules/route";
import { POST as sourceSyncPost } from "@/app/api/sources/[id]/sync/route";
import { POST as accountPost } from "@/app/api/sources/accounts/route";
import { POST as sourcePost } from "@/app/api/sources/route";
import { sourceAccountDeps } from "@/app/api/sources/accounts/deps";
import { sourceDetailDeps } from "@/app/api/sources/[id]/deps";
import { sourceRuleDeps } from "@/app/api/sources/[id]/rules/deps";
import { sourceSyncDeps } from "@/app/api/sources/[id]/sync/deps";
import { sourceDeps } from "@/app/api/sources/deps";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidConnectedAccountError,
  SourceHasDeletionMarkersError,
  assertNoPlaintextSecrets,
  planNextSourceRule,
  summarizeActiveSourceRules,
  verifyConnectedAccountOwnership,
} from "@/lib/sources/contracts";
import { planOriginalRecordVersions } from "@/lib/sources/sync";

type MutableDeps = Record<string, unknown>;

const USER_ID = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const SOURCE_A = "33333333-3333-4333-8333-333333333333";

const originalSourceDeps = { ...sourceDeps };
const originalSourceAccountDeps = { ...sourceAccountDeps };
const originalSourceDetailDeps = { ...sourceDetailDeps };
const originalSourceRuleDeps = { ...sourceRuleDeps };
const originalSourceSyncDeps = { ...sourceSyncDeps };

beforeEach(() => {
  Object.assign(sourceDeps as unknown as MutableDeps, originalSourceDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });
  Object.assign(sourceAccountDeps as unknown as MutableDeps, originalSourceAccountDeps, {
    auth: async () => ({ userId: USER_ID }),
  });
  Object.assign(sourceDetailDeps as unknown as MutableDeps, originalSourceDetailDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });
  Object.assign(sourceRuleDeps as unknown as MutableDeps, originalSourceRuleDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });
  Object.assign(sourceSyncDeps as unknown as MutableDeps, originalSourceSyncDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => projectId,
  });
});

afterEach(() => {
  Object.assign(sourceDeps as unknown as MutableDeps, originalSourceDeps);
  Object.assign(sourceAccountDeps as unknown as MutableDeps, originalSourceAccountDeps);
  Object.assign(sourceDetailDeps as unknown as MutableDeps, originalSourceDetailDeps);
  Object.assign(sourceRuleDeps as unknown as MutableDeps, originalSourceRuleDeps);
  Object.assign(sourceSyncDeps as unknown as MutableDeps, originalSourceSyncDeps);
});

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("connected account config rejects nested plaintext secret keys", () => {
  assert.throws(
    () =>
      assertNoPlaintextSecrets({
        profile: { accessToken: "plain-secret" },
      }),
    InvalidConnectedAccountError
  );
});

test("connected account ownership rejects another user's real row", () => {
  assert.throws(
    () =>
      verifyConnectedAccountOwnership(USER_ID, SOURCE_A, {
        id: SOURCE_A,
        userId: "user-b",
      }),
    InvalidConnectedAccountError
  );
});

test("next source rule plan increments version and deactivates active same-type rules", () => {
  const plan = planNextSourceRule(
    [
      { id: "rule-1", version: 1, ruleType: "selection", enabled: false },
      { id: "rule-2", version: 2, ruleType: "selection", enabled: true },
      { id: "rule-3", version: 3, ruleType: "review", enabled: true },
    ],
    "selection",
    true
  );

  assert.equal(plan.nextVersion, 4);
  assert.deepEqual(plan.deactivateRuleIds, ["rule-2"]);
});

test("active source rule summary keeps the latest enabled version per rule type", () => {
  const activeRules = summarizeActiveSourceRules([
    { id: "rule-1", version: 1, ruleType: "selection", enabled: true },
    { id: "rule-2", version: 2, ruleType: "selection", enabled: true },
    { id: "rule-3", version: 3, ruleType: "review", enabled: true },
    { id: "rule-4", version: 4, ruleType: "review", enabled: false },
  ]);

  assert.equal(activeRules.selection?.id, "rule-2");
  assert.equal(activeRules.review?.id, "rule-3");
});

test("original record version planning appends immutable versions per externalId", () => {
  const versions = planOriginalRecordVersions(
    [
      { externalId: "a", version: 2 },
      { externalId: "b", version: 1 },
    ],
    ["a", "b", "a", "c"]
  );

  assert.deepEqual(versions, [3, 2, 4, 1]);
});

test("source detail GET uses explicit project scope", async () => {
  let receivedProjectId: unknown;
  Object.assign(sourceDetailDeps as unknown as MutableDeps, {
    getSourceDetail: async (_userId: string, sourceId: string, projectId?: string) => {
      receivedProjectId = projectId;
      return {
        source: { id: sourceId, name: "feed-a" },
        connectedAccount: null,
        rules: [],
        activeRules: {},
        recentRuns: [],
        originalCount: 0,
      };
    },
  });

  const response = await sourceGet(
    new NextRequest(`http://localhost/api/sources/${SOURCE_A}?projectId=${PROJECT_A}`),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(response.status, 200);
  assert.equal(receivedProjectId, PROJECT_A);
});

test("source id routes reject omitted project scope", async () => {
  let loaded = false;
  Object.assign(sourceDetailDeps as unknown as MutableDeps, {
    getSourceDetail: async () => {
      loaded = true;
      return {};
    },
  });

  const response = await sourceGet(
    new NextRequest(`http://localhost/api/sources/${SOURCE_A}`),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(response.status, 400);
  assert.equal(loaded, false);
});

test("source PATCH rejects invalid explicit project scope before mutating", async () => {
  let mutated = false;
  Object.assign(sourceDetailDeps as unknown as MutableDeps, {
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    setSourceEnabled: async () => {
      mutated = true;
      return { id: SOURCE_A };
    },
  });

  const response = await sourcePatch(
    jsonRequest(`/api/sources/${SOURCE_A}`, {
      projectId: "not-a-project",
      enabled: true,
    }),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(response.status, 400);
  assert.equal(mutated, false);
});

test("source DELETE preserves permanent deletion history", async () => {
  Object.assign(sourceDetailDeps as unknown as MutableDeps, {
    deleteSource: async () => {
      throw new SourceHasDeletionMarkersError();
    },
  });

  const response = await sourceDelete(
    new NextRequest(
      `http://localhost/api/sources/${SOURCE_A}?projectId=${PROJECT_A}`,
      { method: "DELETE" }
    ),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(response.status, 409);
});

test("source rule POST rejects unsupported rule types", async () => {
  const response = await sourceRulePost(
    jsonRequest(`/api/sources/${SOURCE_A}/rules`, {
      projectId: PROJECT_A,
      ruleType: "bad-type",
      config: {},
    }),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(response.status, 400);
});

test("source rule and sync routes require explicit project scope", async () => {
  let ruleCreated = false;
  let sourceLoaded = false;
  Object.assign(sourceRuleDeps as unknown as MutableDeps, {
    addSourceRule: async () => {
      ruleCreated = true;
      return {};
    },
  });
  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    getOwnedSource: async () => {
      sourceLoaded = true;
      return {};
    },
  });

  const ruleResponse = await sourceRulePost(
    jsonRequest(`/api/sources/${SOURCE_A}/rules`, {
      ruleType: "selection",
      config: {},
    }),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );
  const syncResponse = await sourceSyncPost(
    new NextRequest(`http://localhost/api/sources/${SOURCE_A}/sync`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: SOURCE_A }) }
  );

  assert.equal(ruleResponse.status, 400);
  assert.equal(syncResponse.status, 400);
  assert.equal(ruleCreated, false);
  assert.equal(sourceLoaded, false);
});

test("source POST validates initial rule config", async () => {
  let created = false;
  Object.assign(sourceDeps as unknown as MutableDeps, {
    createSource: async () => {
      created = true;
      return { id: SOURCE_A };
    },
  });

  const response = await sourcePost(
    jsonRequest("/api/sources", {
      projectId: PROJECT_A,
      kind: "rss",
      name: "intel feed",
      feedUrl: "https://example.com/feed.xml",
      initialRule: {
        ruleType: "selection",
        config: "not-an-object",
      },
    })
  );

  assert.equal(response.status, 400);
  assert.equal(created, false);
});

test("connected account POST rejects all opaque credential config", async () => {
  let created = false;
  Object.assign(sourceAccountDeps as unknown as MutableDeps, {
    createConnectedAccount: async () => {
      created = true;
      return {};
    },
  });

  const response = await accountPost(
    jsonRequest("/api/sources/accounts", {
      provider: "slack",
      accountKey: "team-a",
      config: { apiKey: "plain-secret" },
    })
  );

  assert.equal(response.status, 400);
  assert.equal(created, false);
});
