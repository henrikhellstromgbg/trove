import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "@/app/api/pipelines/[id]/route";
import { POST as runNowPost } from "@/app/api/pipelines/[id]/run/route";
import {
  POST as createPipelinePost,
  pipelineCreateDeps,
} from "@/app/api/pipelines/route";
import { pipelineApiDeps } from "@/lib/pipelines/api";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { InvalidProjectError } from "@/lib/projects";
import type { PipelineSpec } from "@/lib/pipelines/types";

const USER_ID = "user-a";
const PIPELINE_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-21T09:30:00.000Z");

type MutableDeps = Record<string, unknown>;

const originalDeps = { ...pipelineApiDeps };
const originalCreateDeps = { ...pipelineCreateDeps };

class MockDb {
  selectResults: unknown[][] = [];
  insertCalls = 0;
  updateCalls = 0;
  deleteCalls = 0;
  insertValues: Array<Record<string, unknown>> = [];
  updateValues: Array<Record<string, unknown>> = [];

  select() {
    const rows = this.selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      where: () => chain,
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
    };
    return chain;
  }

  update() {
    this.updateCalls += 1;
    const chain = {
      set: (values: Record<string, unknown>) => {
        this.updateValues.push(values);
        return chain;
      },
      where: async () => [],
    };
    return chain;
  }

  delete() {
    this.deleteCalls += 1;
    const chain = {
      where: async () => [],
    };
    return chain;
  }
}

const baseSpec: PipelineSpec = {
  name: "weekly-digest",
  cron: "0 15 * * 5",
  filter: { capturedWithinDays: 7 },
  prompt:
    "Below is a list of items you saved this past week. Write a useful summary with highlights.",
  outputShape: "summary_with_highlights",
  deliverByEmail: true,
  retrieval: false,
  includeForgotten: true,
  runOnNewItem: false,
};

function pipelineRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PIPELINE_ID,
    userId: USER_ID,
    projectId: PROJECT_ID,
    name: baseSpec.name,
    description: "friday weekly summary of what you saved, plus one forgotten item",
    spec: baseSpec,
    cron: baseSpec.cron,
    enabled: true,
    nextRunAt: new Date("2026-07-24T15:00:00.000Z"),
    lastRunAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function routeParams(id = PIPELINE_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  Object.assign(pipelineApiDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async (_userId: string, projectId: unknown) => {
      if (projectId !== PROJECT_ID) {
        throw new InvalidProjectError();
      }
      return PROJECT_ID;
    },
    runPipelineSpec: async () => ({
      shape: "summary_with_highlights" as const,
      summary: "A concise weekly summary",
      highlights: ["Item one", "Item two"],
    }),
    now: () => NOW,
  });
});

afterEach(() => {
  Object.assign(pipelineApiDeps as unknown as MutableDeps, originalDeps);
  Object.assign(pipelineCreateDeps as unknown as MutableDeps, originalCreateDeps);
});

test("POST /api/pipelines validates the project before compiling", async () => {
  let compileCalls = 0;
  Object.assign(pipelineCreateDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    compilePipelineDescription: async () => {
      compileCalls += 1;
      return baseSpec;
    },
  });

  const response = await createPipelinePost(
    new NextRequest("http://localhost/api/pipelines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: OTHER_PROJECT_ID,
        description: "Create a useful weekly summary for this project",
      }),
    })
  );

  assert.equal(response.status, 400);
  assert.equal(compileCalls, 0);
});

test("PATCH /api/pipelines/[id] updates editable fields and keeps row columns synchronized", async () => {
  const db = new MockDb();
  db.selectResults.push([pipelineRow()]);
  Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

  const response = await PATCH(
    new NextRequest(`http://localhost/api/pipelines/${PIPELINE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        name: "morning-brief-edited",
        description: "weekday morning brief for the project with retrieval enabled",
        cron: "0 9 * * 1-5",
        filter: { types: ["url"], tagsAny: ["priority"] },
        prompt:
          "Review the matching items and produce a compact list of the most important changes.",
        outputShape: "list",
        deliverByEmail: false,
        retrieval: true,
        retrievalQuery: "priority changes",
        includeForgotten: false,
        enabled: false,
      }),
    }),
    routeParams()
  );

  assert.equal(response.status, 200);
  assert.equal(db.updateCalls, 1);
  assert.equal(db.updateValues.length, 1);
  assert.deepEqual(db.updateValues[0], {
    description: "weekday morning brief for the project with retrieval enabled",
    enabled: false,
    spec: {
      name: "morning-brief-edited",
      cron: "0 9 * * 1-5",
      filter: { types: ["url"], tagsAny: ["priority"] },
      prompt:
        "Review the matching items and produce a compact list of the most important changes.",
      outputShape: "list",
      deliverByEmail: false,
      retrieval: true,
      retrievalQuery: "priority changes",
      includeForgotten: false,
      runOnNewItem: false,
    },
    name: "morning-brief-edited",
    cron: "0 9 * * 1-5",
    nextRunAt: nextRunFromCron("0 9 * * 1-5", NOW),
  });
});

test("PATCH /api/pipelines/[id] rejects retrievalQuery when retrieval remains disabled", async () => {
  const db = new MockDb();
  db.selectResults.push([pipelineRow()]);
  Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

  const response = await PATCH(
    new NextRequest(`http://localhost/api/pipelines/${PIPELINE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        retrievalQuery: "quote the most relevant lines",
      }),
    }),
    routeParams()
  );

  assert.equal(response.status, 400);
  assert.equal(db.updateCalls, 0);
});

test("DELETE /api/pipelines/[id] requires an explicit projectId", async () => {
  const db = new MockDb();
  Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

  const response = await DELETE(
    new NextRequest(`http://localhost/api/pipelines/${PIPELINE_ID}`, {
      method: "DELETE",
    }),
    routeParams()
  );

  assert.equal(response.status, 400);
  assert.equal(db.deleteCalls, 0);
});

test("POST /api/pipelines/[id]/run requires an explicit projectId", async () => {
  const db = new MockDb();
  Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

  const response = await runNowPost(
    new NextRequest(`http://localhost/api/pipelines/${PIPELINE_ID}/run`, {
      method: "POST",
    }),
    routeParams()
  );

  assert.equal(response.status, 400);
  assert.equal(db.insertCalls, 0);
});

test("POST /api/pipelines/[id]/run records a completed run for the scoped project", async () => {
  const db = new MockDb();
  const runCalls: unknown[][] = [];
  db.selectResults.push([pipelineRow()]);
  Object.assign(pipelineApiDeps as unknown as MutableDeps, {
    db,
    runPipelineSpec: async (...args: unknown[]) => {
      runCalls.push(args);
      return {
        shape: "summary_with_highlights" as const,
        summary: "A concise weekly summary",
        highlights: ["Item one", "Item two"],
      };
    },
  });

  const response = await runNowPost(
    new NextRequest(
      `http://localhost/api/pipelines/${PIPELINE_ID}/run?projectId=${PROJECT_ID}`,
      {
        method: "POST",
      }
    ),
    routeParams()
  );

  assert.equal(response.status, 200);
  assert.deepEqual(runCalls[0], [USER_ID, PROJECT_ID, baseSpec]);
  assert.equal(db.insertCalls, 1);
  assert.deepEqual(db.insertValues[0], {
    pipelineId: PIPELINE_ID,
    userId: USER_ID,
    status: "completed",
    output: {
      shape: "summary_with_highlights",
      summary: "A concise weekly summary",
      highlights: ["Item one", "Item two"],
    },
    completedAt: NOW,
  });
  assert.equal(db.updateCalls, 1);
  assert.deepEqual(db.updateValues[0], {
    lastRunAt: NOW,
    nextRunAt: nextRunFromCron(baseSpec.cron, NOW),
  });
});

for (const ownershipCase of [
  { name: "foreign user", row: pipelineRow({ userId: "user-b" }) },
  {
    name: "wrong project",
    row: pipelineRow({ projectId: OTHER_PROJECT_ID }),
  },
]) {
  test(`PATCH /api/pipelines/[id] rejects a ${ownershipCase.name} row`, async () => {
    const db = new MockDb();
    db.selectResults.push([ownershipCase.row]);
    Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

    const response = await PATCH(
      new NextRequest(`http://localhost/api/pipelines/${PIPELINE_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: PROJECT_ID, enabled: false }),
      }),
      routeParams()
    );

    assert.equal(response.status, 404);
    assert.equal(db.updateCalls, 0);
  });

  test(`DELETE /api/pipelines/[id] rejects a ${ownershipCase.name} row`, async () => {
    const db = new MockDb();
    db.selectResults.push([ownershipCase.row]);
    Object.assign(pipelineApiDeps as unknown as MutableDeps, { db });

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/pipelines/${PIPELINE_ID}?projectId=${PROJECT_ID}`,
        { method: "DELETE" }
      ),
      routeParams()
    );

    assert.equal(response.status, 404);
    assert.equal(db.deleteCalls, 0);
  });

  test(`POST /api/pipelines/[id]/run rejects a ${ownershipCase.name} row`, async () => {
    const db = new MockDb();
    let runCalls = 0;
    db.selectResults.push([ownershipCase.row]);
    Object.assign(pipelineApiDeps as unknown as MutableDeps, {
      db,
      runPipelineSpec: async () => {
        runCalls += 1;
        return { shape: "list" as const, items: [] };
      },
    });

    const response = await runNowPost(
      new NextRequest(
        `http://localhost/api/pipelines/${PIPELINE_ID}/run?projectId=${PROJECT_ID}`,
        { method: "POST" }
      ),
      routeParams()
    );

    assert.equal(response.status, 404);
    assert.equal(runCalls, 0);
    assert.equal(db.insertCalls, 0);
  });
}
