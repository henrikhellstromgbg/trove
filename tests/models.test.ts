import assert from "node:assert/strict";
import { test } from "node:test";
import { MODELS, pipelineRunModel } from "@/lib/ai/models";

// Locks the documented model choices (docs/architecture-v2.md "Model
// configuration") so a stray edit to a hardcoded id can't drift them apart.
test("model roles match the documented configuration", () => {
  // Answers + pipeline compilation: Sonnet 4.6.
  assert.equal(MODELS.answer, "claude-sonnet-4-6");
  assert.equal(MODELS.pipelineCompile, "claude-sonnet-4-6");
  // Extraction, enrichment, ordinary pipeline runs, topic naming: Haiku 4.5.
  assert.equal(MODELS.pipelineRun, "claude-haiku-4-5");
  assert.equal(MODELS.extract, "claude-haiku-4-5");
  assert.equal(MODELS.enrich, "claude-haiku-4-5");
  assert.equal(MODELS.topicNaming, "claude-haiku-4-5");
  // Embeddings: Gemini.
  assert.equal(MODELS.embed, "gemini-embedding-001");
});

test("a retrieval-heavy pipeline run uses the stronger model", () => {
  // Ordinary summary-only run stays on Haiku; a retrieval run reasons over full
  // chunk text, so it gets the Sonnet-class model.
  assert.equal(pipelineRunModel(false), MODELS.pipelineRun);
  assert.equal(pipelineRunModel(false), "claude-haiku-4-5");
  assert.equal(pipelineRunModel(true), MODELS.pipelineRetrievalRun);
  assert.equal(pipelineRunModel(true), "claude-sonnet-4-6");
});
