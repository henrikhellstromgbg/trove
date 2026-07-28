import assert from "node:assert/strict";
import test from "node:test";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { nextSourceRun, SOURCE_TIME_ZONE } from "@/lib/sources/schedule";

// The cron "0 9 * * 0" is Sunday at 09:00. Read in a real timezone it must track
// daylight saving: 07:00Z in summer (UTC+2), 08:00Z in winter (UTC+1).
test("nextRunFromCron reads the cron in the given timezone, DST included", () => {
  const summerFrom = new Date("2026-07-28T00:00:00Z");
  const winterFrom = new Date("2026-01-01T00:00:00Z");

  assert.equal(
    nextRunFromCron("0 9 * * 0", summerFrom, "Europe/Stockholm")?.toISOString(),
    "2026-08-02T07:00:00.000Z"
  );
  assert.equal(
    nextRunFromCron("0 9 * * 0", winterFrom, "Europe/Stockholm")?.toISOString(),
    "2026-01-04T08:00:00.000Z"
  );
});

test("nextRunFromCron defaults to UTC so pipelines are unchanged", () => {
  const from = new Date("2026-07-28T00:00:00Z");
  assert.equal(
    nextRunFromCron("0 9 * * 0", from)?.toISOString(),
    "2026-08-02T09:00:00.000Z"
  );
});

test("nextSourceRun resolves against a real local zone and returns a future time", () => {
  assert.ok(SOURCE_TIME_ZONE.length > 0);
  const from = new Date("2026-07-28T00:00:00Z");
  const next = nextSourceRun("0 9 * * 0", from);
  assert.ok(next instanceof Date);
  assert.ok(next!.getTime() > from.getTime());
});
