import { InvalidSourceRuleError } from "./contracts";

// An active review rule decides whether a freshly imported item is held in the
// review queue instead of flowing straight into processing. Rules live in
// `source_rule` (ruleType "review"), are versioned per source and scoped to a
// project; only the highest-version enabled rule for a source is applied.
// See docs/architecture-v2.md and docs/backend-phase-2026-07-21.md.

export type ReviewRuleMode = "all" | "match";

export type ReviewRuleConfig = {
  mode: ReviewRuleMode;
  // Case-insensitive substrings matched against the item's source label and
  // text. Required and non-empty when mode is "match".
  contains: string[];
};

export type ReviewCandidate = {
  source: string | null;
  text: string | null;
};

// The initial status an imported item receives. Review items are held; pending
// items continue into the ingest worker.
export type ImportedItemStatus = "review" | "pending";

export function parseReviewRuleConfig(raw: unknown): ReviewRuleConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new InvalidSourceRuleError("review rule config must be an object");
  }

  const source = raw as Record<string, unknown>;
  const mode = source.mode ?? "match";
  if (mode !== "all" && mode !== "match") {
    throw new InvalidSourceRuleError('review rule mode must be "all" or "match"');
  }

  const contains = readPhraseList(source.contains);

  if (mode === "match" && contains.length === 0) {
    throw new InvalidSourceRuleError(
      'review rule mode "match" requires at least one "contains" phrase'
    );
  }

  return { mode, contains };
}

// Never throws: an unparseable stored config is treated as no active rule so a
// corrupt row can never wedge ingestion.
export function safeParseReviewRuleConfig(raw: unknown): ReviewRuleConfig | null {
  try {
    return parseReviewRuleConfig(raw);
  } catch {
    return null;
  }
}

export function shouldHoldForReview(
  config: ReviewRuleConfig,
  candidate: ReviewCandidate
): boolean {
  if (config.mode === "all") return true;

  const haystack = `${candidate.source ?? ""}\n${candidate.text ?? ""}`.toLowerCase();
  return config.contains.some((phrase) => haystack.includes(phrase.toLowerCase()));
}

export function importedItemStatus(
  config: ReviewRuleConfig | null,
  candidate: ReviewCandidate
): ImportedItemStatus {
  if (config && shouldHoldForReview(config, candidate)) return "review";
  return "pending";
}

function readPhraseList(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new InvalidSourceRuleError("review rule contains must be an array of strings");
  }
  const phrases = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return [...new Set(phrases)];
}
