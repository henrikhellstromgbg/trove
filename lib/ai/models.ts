// Single source of truth for model ids. Roles map to the choices documented in
// docs/architecture-v2.md "Model configuration":
//   - Answers and pipeline compilation: Claude Sonnet 4.6
//   - Extraction, enrichment and ordinary pipeline runs: Claude Haiku 4.5
//   - Embeddings: Gemini gemini-embedding-001 (768 dims)
// Retrieval-heavy pipeline runs are the one addition: they reason over full
// chunk text, so they get the stronger Sonnet-class model rather than Haiku.
export const MODELS = {
  answer: "claude-sonnet-4-6",
  pipelineCompile: "claude-sonnet-4-6",
  pipelineRetrievalRun: "claude-sonnet-4-6",
  pipelineRun: "claude-haiku-4-5",
  extract: "claude-haiku-4-5",
  enrich: "claude-haiku-4-5",
  topicNaming: "claude-haiku-4-5",
  embed: "gemini-embedding-001",
} as const;

// Ordinary pipeline runs use Haiku; a retrieval-heavy run gets the stronger
// model because it reasons over full text, not just title/summary/tags.
export function pipelineRunModel(retrieval: boolean): string {
  return retrieval ? MODELS.pipelineRetrievalRun : MODELS.pipelineRun;
}
