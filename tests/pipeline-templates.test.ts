import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pipelines/templates/route";
import { pipelineTemplateDeps } from "@/app/api/pipelines/templates/deps";
import { InvalidProjectError } from "@/lib/projects";
import {
  buildStarterPipelineTemplate,
  describeStarterPipelineSchedule,
  listStarterPipelineTemplates,
} from "@/lib/pipelines/templates";

const USER_ID = "user-a";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

type MutableDeps = Record<string, unknown>;

const originalDeps = { ...pipelineTemplateDeps };

class MockDb {
  selectResults: unknown[][] = [];
  insertCalls = 0;
  insertValues: Array<Record<string, unknown>> = [];
  insertResult: Array<{ id: string }> = [{ id: "pipeline-1" }];

  select() {
    const rows = this.selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => rows,
      then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
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
      onConflictDoNothing: () => chain,
      returning: async () => this.insertResult,
    };
    return chain;
  }
}

beforeEach(() => {
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: USER_ID }),
    requireProjectId: async () => PROJECT_ID,
  });
});

afterEach(() => {
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, originalDeps);
});

test("starter template definitions keep Friday digest naming and weekday morning defaults", () => {
  const templates = listStarterPipelineTemplates();
  assert.deepEqual(
    templates.map((template) => template.id),
    ["morning-brief", "weekly-summary"]
  );

  const morning = buildStarterPipelineTemplate("morning-brief");
  assert.equal(morning.pipelineName, "morning-brief");
  assert.equal(morning.spec.cron, "0 8 * * 1-5");
  assert.equal(morning.spec.deliverByEmail, false);
  assert.equal(morning.spec.includeForgotten, false);
  assert.equal(
    describeStarterPipelineSchedule(morning.spec.cron),
    "Weekdays 08:00 UTC"
  );

  const weekly = buildStarterPipelineTemplate("weekly-summary");
  assert.equal(weekly.pipelineName, "weekly-digest");
  assert.equal(weekly.spec.cron, "0 15 * * 5");
  assert.equal(weekly.spec.deliverByEmail, true);
  assert.equal(weekly.spec.includeForgotten, true);
  assert.equal(
    describeStarterPipelineSchedule(weekly.spec.cron),
    "Fridays 15:00 UTC"
  );
});

test("GET /api/pipelines/templates returns project installation state", async () => {
  const db = new MockDb();
  db.selectResults.push([{ id: "pipeline-weekly", name: "weekly-digest" }]);
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, { db });

  const response = await GET(
    new NextRequest(
      `http://localhost/api/pipelines/templates?projectId=${PROJECT_ID}`
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.templates.length, 2);

  const morning = body.templates.find(
    (template: { id: string }) => template.id === "morning-brief"
  );
  assert.equal(morning.installed, false);
  assert.equal(morning.installedPipelineId, null);

  const weekly = body.templates.find(
    (template: { id: string }) => template.id === "weekly-summary"
  );
  assert.equal(weekly.installed, true);
  assert.equal(weekly.installedPipelineId, "pipeline-weekly");
  assert.equal(weekly.pipelineName, "weekly-digest");
});

test("GET /api/pipelines/templates rejects invalid project ids", async () => {
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, {
    db: new MockDb(),
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
  });

  const response = await GET(
    new NextRequest(
      "http://localhost/api/pipelines/templates?projectId=not-a-project"
    )
  );

  assert.equal(response.status, 400);
});

test("pipeline templates require an explicit project id", async () => {
  const getResponse = await GET(
    new NextRequest("http://localhost/api/pipelines/templates")
  );
  assert.equal(getResponse.status, 400);

  const postResponse = await POST(
    new NextRequest("http://localhost/api/pipelines/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: "morning-brief" }),
    })
  );
  assert.equal(postResponse.status, 400);
});

test("POST /api/pipelines/templates creates a starter pipeline with overrides", async () => {
  const db = new MockDb();
  db.selectResults.push([]);
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, { db });

  const response = await POST(
    new NextRequest("http://localhost/api/pipelines/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId: "morning-brief",
        projectId: PROJECT_ID,
        deliverByEmail: true,
      }),
    })
  );

  assert.equal(response.status, 201);
  assert.equal(db.insertCalls, 1);
  assert.equal(db.insertValues[0].name, "morning-brief");
  assert.equal(db.insertValues[0].templateKey, "morning-brief");
  assert.equal(db.insertValues[0].description, templatesDescription("morning"));
  assert.equal(
    (db.insertValues[0].spec as { deliverByEmail: boolean; cron: string })
      .deliverByEmail,
    true
  );
  assert.equal(
    (db.insertValues[0].spec as { deliverByEmail: boolean; cron: string }).cron,
    "0 8 * * 1-5"
  );

  const body = await response.json();
  assert.equal(body.created, true);
  assert.equal(body.pipelineId, "pipeline-1");
});

test("POST /api/pipelines/templates is idempotent when the starter pipeline already exists", async () => {
  const db = new MockDb();
  db.selectResults.push([{ id: "pipeline-existing" }]);
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, { db });

  const response = await POST(
    new NextRequest("http://localhost/api/pipelines/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId: "weekly-summary",
        projectId: PROJECT_ID,
      }),
    })
  );

  assert.equal(response.status, 200);
  assert.equal(db.insertCalls, 0);

  const body = await response.json();
  assert.equal(body.created, false);
  assert.equal(body.pipelineId, "pipeline-existing");
  assert.equal(body.template.pipelineName, "weekly-digest");
});

test("concurrent template installs resolve to the database winner", async () => {
  const db = new MockDb();
  db.selectResults.push([], [{ id: "pipeline-winner" }]);
  db.insertResult = [];
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, { db });

  const response = await POST(
    new NextRequest("http://localhost/api/pipelines/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId: "morning-brief",
        projectId: PROJECT_ID,
      }),
    })
  );

  assert.equal(response.status, 200);
  assert.equal(db.insertCalls, 1);
  assert.equal((await response.json()).pipelineId, "pipeline-winner");
});

test("POST /api/pipelines/templates validates template ids", async () => {
  Object.assign(pipelineTemplateDeps as unknown as MutableDeps, {
    db: new MockDb(),
  });

  const response = await POST(
    new NextRequest("http://localhost/api/pipelines/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId: "monthly-roundup",
        projectId: PROJECT_ID,
      }),
    })
  );

  assert.equal(response.status, 400);
});

function templatesDescription(kind: "morning") {
  if (kind === "morning") {
    return "weekday morning brief of what landed in the project over the last day";
  }
  return "";
}
