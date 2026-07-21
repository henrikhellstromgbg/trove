import assert from "node:assert/strict";
import test from "node:test";
import { runOnce } from "../lib/submission-lock";

test("runOnce rejects overlapping work and releases the lock", async () => {
  const lock = { current: false };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let runs = 0;

  const first = runOnce(lock, async () => {
    runs += 1;
    await pending;
  });
  const second = await runOnce(lock, async () => {
    runs += 1;
  });

  assert.equal(second, false);
  assert.equal(runs, 1);
  release();
  assert.equal(await first, true);
  assert.equal(await runOnce(lock, async () => void (runs += 1)), true);
  assert.equal(runs, 2);
});
