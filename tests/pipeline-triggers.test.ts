import assert from "node:assert/strict";
import { test } from "node:test";
import {
  itemMatchesPipelineFilter,
  selectEventPipelines,
  type EventPipelineCandidate,
  type MatchableItem,
} from "@/lib/pipelines/triggers";

const NOW = new Date("2026-07-22T12:00:00.000Z");

const ITEM: MatchableItem = {
  type: "pdf",
  tags: ["research", "selection"],
  title: "Ruck standards",
  rawText: "A study of loaded march performance.",
  capturedAt: new Date("2026-07-22T11:59:00.000Z"),
};

test("an empty filter matches any item", () => {
  assert.equal(itemMatchesPipelineFilter(ITEM, {}, NOW), true);
});

test("type, tag, contains and recency filters each gate the match", () => {
  assert.equal(itemMatchesPipelineFilter(ITEM, { types: ["pdf"] }, NOW), true);
  assert.equal(itemMatchesPipelineFilter(ITEM, { types: ["image"] }, NOW), false);

  assert.equal(itemMatchesPipelineFilter(ITEM, { tagsAny: ["selection"] }, NOW), true);
  assert.equal(itemMatchesPipelineFilter(ITEM, { tagsAny: ["cooking"] }, NOW), false);

  // contains looks in title and rawText, case-insensitively.
  assert.equal(itemMatchesPipelineFilter(ITEM, { contains: "loaded march" }, NOW), true);
  assert.equal(itemMatchesPipelineFilter(ITEM, { contains: "nutrition" }, NOW), false);

  assert.equal(itemMatchesPipelineFilter(ITEM, { capturedWithinDays: 1 }, NOW), true);
  const old: MatchableItem = { ...ITEM, capturedAt: new Date("2026-07-01T00:00:00.000Z") };
  assert.equal(itemMatchesPipelineFilter(old, { capturedWithinDays: 1 }, NOW), false);
});

const BASE_SPEC = {
  name: "New PDF summary",
  cron: "0 8 * * 1",
  filter: { types: ["pdf"] },
  prompt: "Summarize the newly arrived document for me.",
  outputShape: "text",
  runOnNewItem: true,
};

function candidate(over: Partial<EventPipelineCandidate>): EventPipelineCandidate {
  return {
    id: "p1",
    userId: "user-a",
    projectId: "proj-a",
    enabled: true,
    lastRunAt: null,
    spec: BASE_SPEC,
    ...over,
  };
}

test("selectEventPipelines picks an opted-in, matching, off-cooldown pipeline", () => {
  const selected = selectEventPipelines(ITEM, [candidate({})], NOW, 10 * 60_000);
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, "p1");
  // The spec comes back parsed (defaults applied).
  assert.equal(selected[0]?.spec.runOnNewItem, true);
  assert.equal(selected[0]?.spec.deliverByEmail, false);
});

test("selectEventPipelines excludes disabled, non-opted-in, non-matching, or on-cooldown pipelines", () => {
  const disabled = candidate({ id: "disabled", enabled: false });
  const notOptedIn = candidate({
    id: "cron-only",
    spec: { ...BASE_SPEC, runOnNewItem: false },
  });
  const wrongFilter = candidate({
    id: "images",
    spec: { ...BASE_SPEC, filter: { types: ["image"] } },
  });
  const recentlyRan = candidate({
    id: "cooling",
    lastRunAt: new Date(NOW.getTime() - 60_000), // 1 min ago, inside a 10-min cooldown
  });
  const cooledDown = candidate({
    id: "ready-again",
    lastRunAt: new Date(NOW.getTime() - 20 * 60_000), // 20 min ago
  });

  const selected = selectEventPipelines(
    ITEM,
    [disabled, notOptedIn, wrongFilter, recentlyRan, cooledDown],
    NOW,
    10 * 60_000
  );

  assert.deepEqual(
    selected.map((p) => p.id),
    ["ready-again"]
  );
});

test("a malformed spec is skipped, not thrown", () => {
  const bad = candidate({ id: "broken", spec: { not: "a spec" } });
  const selected = selectEventPipelines(ITEM, [bad], NOW, 10 * 60_000);
  assert.equal(selected.length, 0);
});
