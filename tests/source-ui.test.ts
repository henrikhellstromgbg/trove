import assert from "node:assert/strict";
import test from "node:test";
import { SUPPORTED_SOURCE_KINDS } from "../lib/sources/contracts";
import {
  SOURCE_KIND_OPTIONS,
  isLocalSourceKind,
  sourceKindLabel,
} from "../app/p/[slug]/sources/source-display";
import { requestJson } from "../app/p/[slug]/sources/request-json";
import {
  deleteStateReducer,
  initialDeleteState,
} from "../app/p/[slug]/sources/[id]/delete-state";
import {
  buildSourceRequestBody,
  sourcePrimaryFieldFilled,
  type SourceFormValues,
} from "../app/p/[slug]/sources/new/source-form-data";
import {
  DEFAULT_SCHEDULE,
  buildScheduleCron,
} from "../app/p/[slug]/sources/new/schedule-cron";
import { isCronValid } from "../lib/pipelines/cron";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function values(overrides: Partial<SourceFormValues>): SourceFormValues {
  return {
    kind: "rss",
    name: "  Source name  ",
    feedUrl: "  https://example.com/feed.xml  ",
    url: "",
    selector: "",
    followLinks: false,
    channelId: "",
    mboxPath: "",
    senderAllow: "",
    senderBlock: "",
    promoBlocklist: "",
    folderPath: "",
    globs: "",
    cron: "0 * * * *",
    ...overrides,
  };
}

test("source UI options stay aligned with the backend source-kind contract", () => {
  assert.deepEqual(
    SOURCE_KIND_OPTIONS.map((option) => option.value).sort(),
    [...SUPPORTED_SOURCE_KINDS].sort(),
  );
  assert.equal(sourceKindLabel("youtube_channel"), "YouTube channel");
});

test("source form builds the preserved payload for every supported kind", () => {
  const rss = values({ kind: "rss" });
  assert.equal(sourcePrimaryFieldFilled(rss), true);
  assert.deepEqual(buildSourceRequestBody(rss, PROJECT_ID), {
    kind: "rss",
    name: "Source name",
    projectId: PROJECT_ID,
    cron: "0 * * * *",
    feedUrl: "https://example.com/feed.xml",
  });

  const web = values({
    kind: "web_scrape",
    feedUrl: "",
    url: " https://example.com/blog ",
    selector: " article a ",
    followLinks: true,
  });
  assert.deepEqual(buildSourceRequestBody(web, PROJECT_ID), {
    kind: "web_scrape",
    name: "Source name",
    projectId: PROJECT_ID,
    cron: "0 * * * *",
    url: "https://example.com/blog",
    selector: "article a",
    followLinks: true,
  });

  const slack = values({
    kind: "slack_channel",
    feedUrl: "",
    channelId: " C0123456789 ",
  });
  assert.deepEqual(buildSourceRequestBody(slack, PROJECT_ID), {
    kind: "slack_channel",
    name: "Source name",
    projectId: PROJECT_ID,
    cron: "0 * * * *",
    channelId: "C0123456789",
  });

  const mail = values({
    kind: "mail_folder",
    feedUrl: "",
    mboxPath: " /mail/INBOX.mbox ",
    senderAllow: "a@example.com, b@example.com\na@example.com",
    senderBlock: "blocked.example.com",
    promoBlocklist: "sale, unsubscribe",
  });
  assert.equal(isLocalSourceKind(mail.kind), true);
  assert.deepEqual(buildSourceRequestBody(mail, PROJECT_ID), {
    kind: "mail_folder",
    name: "Source name",
    projectId: PROJECT_ID,
    cron: "0 * * * *",
    mboxPath: "/mail/INBOX.mbox",
    senderAllow: ["a@example.com", "b@example.com"],
    senderBlock: ["blocked.example.com"],
    promoBlocklist: ["sale", "unsubscribe"],
  });

  const folder = values({
    kind: "folder_watch",
    feedUrl: "",
    folderPath: " /Documents/inbox ",
    globs: "**/*.pdf, **/*.md",
  });
  assert.equal(isLocalSourceKind(folder.kind), true);
  assert.deepEqual(buildSourceRequestBody(folder, PROJECT_ID), {
    kind: "folder_watch",
    name: "Source name",
    projectId: PROJECT_ID,
    cron: "0 * * * *",
    folderPath: "/Documents/inbox",
    globs: ["**/*.pdf", "**/*.md"],
  });
});

test("buildScheduleCron maps every frequency to a valid cron", () => {
  assert.equal(buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency: "hourly" }), "0 * * * *");
  assert.equal(buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency: "every6h" }), "0 */6 * * *");
  assert.equal(
    buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency: "daily", hour: 8 }),
    "0 8 * * *"
  );
  // The whole point of the feature: weekly on Sunday at 09:00.
  assert.equal(
    buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency: "weekly", weekday: 0, hour: 9 }),
    "0 9 * * 0"
  );
  assert.equal(
    buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency: "monthly", dayOfMonth: 1, hour: 6 }),
    "0 6 1 * *"
  );

  for (const frequency of ["hourly", "every6h", "daily", "weekly", "monthly"] as const) {
    assert.equal(
      isCronValid(buildScheduleCron({ ...DEFAULT_SCHEDULE, frequency })),
      true,
      `${frequency} must produce a cron the server accepts`
    );
  }
});

test("requestJson normalizes HTTP, invalid-body, and network failures", async () => {
  const ok = await requestJson<{ id: string }>("/ok", undefined, async () =>
    new Response(JSON.stringify({ id: "source-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.deepEqual(ok, { ok: true, data: { id: "source-1" } });

  const apiError = await requestJson("/error", undefined, async () =>
    new Response(JSON.stringify({ error: "Source cannot be deleted" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.deepEqual(apiError, { ok: false, error: "Source cannot be deleted" });

  const invalidBody = await requestJson("/invalid", undefined, async () =>
    new Response("not json", { status: 500 })
  );
  assert.deepEqual(invalidBody, { ok: false, error: "Error 500" });

  const networkError = await requestJson("/offline", undefined, async () => {
    throw new Error("offline");
  });
  assert.deepEqual(networkError, {
    ok: false,
    error: "Unable to reach Trove. Try again.",
  });
});

test("failed deletion stays open, becomes retryable, and keeps its error", () => {
  const open = deleteStateReducer(initialDeleteState, { type: "open" });
  const busy = deleteStateReducer(open, { type: "start" });
  assert.equal(deleteStateReducer(busy, { type: "cancel" }), busy);

  const failed = deleteStateReducer(busy, {
    type: "failure",
    error: "Unable to reach Trove. Try again.",
  });
  assert.deepEqual(failed, {
    open: true,
    busy: false,
    error: "Unable to reach Trove. Try again.",
  });
  assert.deepEqual(deleteStateReducer(failed, { type: "cancel" }), initialDeleteState);
});
