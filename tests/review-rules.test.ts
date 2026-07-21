import assert from "node:assert/strict";
import { test } from "node:test";
import {
  importedItemStatus,
  parseReviewRuleConfig,
  safeParseReviewRuleConfig,
  shouldHoldForReview,
} from "@/lib/sources/review-rules";

test('mode "all" holds every candidate', () => {
  const config = parseReviewRuleConfig({ mode: "all" });
  assert.equal(config.mode, "all");
  assert.equal(shouldHoldForReview(config, { source: "anything", text: null }), true);
  assert.equal(shouldHoldForReview(config, { source: null, text: null }), true);
});

test('mode "match" holds only when a phrase appears in source or text', () => {
  const config = parseReviewRuleConfig({
    mode: "match",
    contains: ["  Sponsored ", "Sponsored", ""],
  });
  // Trimmed, empties dropped, exact duplicates collapsed.
  assert.deepEqual(config.contains, ["Sponsored"]);

  assert.equal(
    shouldHoldForReview(config, { source: "This is SPONSORED content", text: null }),
    true
  );
  assert.equal(
    shouldHoldForReview(config, { source: "newsletter", text: "a sponsored mention" }),
    true
  );
  assert.equal(
    shouldHoldForReview(config, { source: "newsletter", text: "clean body" }),
    false
  );
});

test("importedItemStatus routes review vs pending", () => {
  const holdAll = parseReviewRuleConfig({ mode: "all" });
  const holdMatch = parseReviewRuleConfig({ mode: "match", contains: ["draft"] });

  assert.equal(importedItemStatus(holdAll, { source: "x", text: null }), "review");
  assert.equal(
    importedItemStatus(holdMatch, { source: "draft note", text: null }),
    "review"
  );
  assert.equal(
    importedItemStatus(holdMatch, { source: "final note", text: null }),
    "pending"
  );
  // No active rule always yields pending.
  assert.equal(importedItemStatus(null, { source: "draft note", text: null }), "pending");
});

test('mode "match" requires at least one phrase', () => {
  assert.throws(() => parseReviewRuleConfig({ mode: "match", contains: [] }), /at least one/);
  assert.throws(() => parseReviewRuleConfig({ mode: "match" }), /at least one/);
});

test("invalid shapes are rejected by parse and swallowed by safeParse", () => {
  assert.throws(() => parseReviewRuleConfig({ mode: "sometimes" }), /mode/);
  assert.throws(() => parseReviewRuleConfig(null), /object/);
  assert.throws(
    () => parseReviewRuleConfig({ mode: "match", contains: "draft" }),
    /array/
  );

  assert.equal(safeParseReviewRuleConfig({ mode: "sometimes" }), null);
  assert.equal(safeParseReviewRuleConfig({ mode: "all" })?.mode, "all");
});
