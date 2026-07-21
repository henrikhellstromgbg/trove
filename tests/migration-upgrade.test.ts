import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("active source-run migration closes duplicates before adding uniqueness", async () => {
  const sql = await readFile(
    "lib/db/migrations/0004_sticky_maria_hill.sql",
    "utf8"
  );
  const cleanup = sql.indexOf("UPDATE \"source_run\"");
  const uniqueIndex = sql.indexOf(
    "CREATE UNIQUE INDEX \"source_run_active_source_idx\""
  );

  assert.notEqual(cleanup, -1);
  assert.notEqual(uniqueIndex, -1);
  assert.ok(cleanup < uniqueIndex);
  assert.match(sql, /ranked_running\."position" > 1/);
});
