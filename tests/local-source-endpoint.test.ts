import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET as localGet } from "@/app/api/sources/local/route";
import { localSourceRouteDeps } from "@/app/api/sources/local/deps";
import { toLocalSourcePayload } from "@/lib/sources/contracts";

type MutableDeps = Record<string, unknown>;

const USER_ID = "user-a";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";

const originalDeps = { ...localSourceRouteDeps };
afterEach(() => {
  Object.assign(localSourceRouteDeps as unknown as MutableDeps, originalDeps);
});

function req() {
  return new NextRequest("http://localhost/api/sources/local", { method: "GET" });
}

test("toLocalSourcePayload flattens config with fixed fields winning", () => {
  const payload = toLocalSourcePayload({
    id: "s1",
    kind: "folder_watch",
    projectId: PROJECT_A,
    name: "Intel drop",
    config: { folderPath: "/Users/me/Drop", globs: ["**/*.pdf"], id: "SHOULD_NOT_WIN" },
    cursor: { version: 1, files: {} },
  });

  assert.equal(payload.id, "s1"); // fixed field wins over a colliding config key
  assert.equal(payload.kind, "folder_watch");
  assert.equal(payload.projectId, PROJECT_A);
  assert.equal(payload.name, "Intel drop");
  assert.equal(payload.folderPath, "/Users/me/Drop");
  assert.deepEqual(payload.globs, ["**/*.pdf"]);
  assert.deepEqual(payload.cursor, { version: 1, files: {} });
});

test("toLocalSourcePayload tolerates a missing/invalid config and null cursor", () => {
  const payload = toLocalSourcePayload({
    id: "s2",
    kind: "mail_folder",
    projectId: PROJECT_A,
    name: "Newsletters",
    config: null,
    cursor: null,
  });
  assert.equal(payload.mboxPath, undefined);
  assert.equal(payload.cursor, null);
  assert.equal(payload.id, "s2");
});

test("GET requires a valid token or session", async () => {
  Object.assign(localSourceRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => null,
  });
  const res = await localGet(req());
  assert.equal(res.status, 401);
});

test("a project-locked token scopes the query to its project and flattens rows", async () => {
  let passedProjectId: unknown = "unset";
  Object.assign(localSourceRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: PROJECT_A }),
    listLocalSourcesForToken: async (_u: string, locked?: string | null) => {
      passedProjectId = locked;
      return [
        {
          id: "s1",
          kind: "mail_folder",
          projectId: PROJECT_A,
          name: "Newsletters",
          config: { mboxPath: "/Users/me/News.mbox", senderAllow: ["brief@"] },
          cursor: null,
        },
      ];
    },
  });

  const res = await localGet(req());
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(passedProjectId, PROJECT_A);
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].kind, "mail_folder");
  assert.equal(body.sources[0].mboxPath, "/Users/me/News.mbox");
  assert.deepEqual(body.sources[0].senderAllow, ["brief@"]);
});

test("an unlocked token passes null scope", async () => {
  let passedProjectId: unknown = "unset";
  Object.assign(localSourceRouteDeps as unknown as MutableDeps, {
    resolveIngestAuth: async () => ({ userId: USER_ID, lockedProjectId: null }),
    listLocalSourcesForToken: async (_u: string, locked?: string | null) => {
      passedProjectId = locked;
      return [];
    },
  });

  const res = await localGet(req());
  assert.equal(res.status, 200);
  assert.equal(passedProjectId, null);
});
