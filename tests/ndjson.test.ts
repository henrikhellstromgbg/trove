import assert from "node:assert/strict";
import test from "node:test";
import { drainNdjson, parseNdjsonRecord } from "../lib/ndjson";

test("drainNdjson keeps a partial trailing record", () => {
  assert.deepEqual(drainNdjson('{"type":"text"}\n{"type":"done"'), {
    records: ['{"type":"text"}'],
    remainder: '{"type":"done"',
  });
});

test("drainNdjson flushes a final record without a newline", () => {
  assert.deepEqual(drainNdjson('{"type":"done"}', true), {
    records: ['{"type":"done"}'],
    remainder: "",
  });
});

test("parseNdjsonRecord exposes malformed records", () => {
  assert.deepEqual(parseNdjsonRecord("not json"), { ok: false });
});
