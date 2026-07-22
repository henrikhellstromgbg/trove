import { PipelineSpecSchema, type PipelineFilter, type PipelineSpec } from "./types";

// The fields of a ready item that a pipeline filter can match on.
export type MatchableItem = {
  type: string;
  tags: string[] | null;
  title: string | null;
  rawText: string | null;
  capturedAt: Date;
};

// Whether a single item satisfies a pipeline filter. Mirrors the SQL in
// lib/pipelines/run.ts loadItems, but for one in-memory item so an arrival can
// be tested without a query. An empty filter matches everything.
export function itemMatchesPipelineFilter(
  item: MatchableItem,
  filter: PipelineFilter,
  now: Date
): boolean {
  if (
    filter.types &&
    filter.types.length > 0 &&
    !(filter.types as readonly string[]).includes(item.type)
  ) {
    return false;
  }

  if (filter.tagsAny && filter.tagsAny.length > 0) {
    const tags = item.tags ?? [];
    if (!filter.tagsAny.some((tag) => tags.includes(tag))) return false;
  }

  if (filter.contains) {
    const needle = filter.contains.toLowerCase();
    const haystack = `${item.title ?? ""}\n${item.rawText ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  if (filter.capturedWithinDays) {
    const cutoff = new Date(now.getTime() - filter.capturedWithinDays * 86_400_000);
    if (item.capturedAt < cutoff) return false;
  }

  return true;
}

export type EventPipelineCandidate = {
  id: string;
  userId: string;
  projectId: string;
  enabled: boolean;
  lastRunAt: Date | null;
  spec: unknown;
};

export type SelectedEventPipeline = {
  id: string;
  userId: string;
  projectId: string;
  spec: PipelineSpec;
};

// Pick the pipelines a newly-ready item should trigger: enabled, opted into
// runOnNewItem, whose filter the item matches, and which have not run within the
// cooldown. The cooldown debounces bursts of arrivals (and coincidental cron
// runs) so a busy source can't fire the same pipeline repeatedly.
export function selectEventPipelines(
  item: MatchableItem,
  candidates: EventPipelineCandidate[],
  now: Date,
  cooldownMs: number
): SelectedEventPipeline[] {
  const selected: SelectedEventPipeline[] = [];

  for (const candidate of candidates) {
    if (!candidate.enabled) continue;

    const parsed = PipelineSpecSchema.safeParse(candidate.spec);
    if (!parsed.success) continue;
    const spec = parsed.data;

    if (!spec.runOnNewItem) continue;
    if (!itemMatchesPipelineFilter(item, spec.filter, now)) continue;

    if (
      candidate.lastRunAt &&
      now.getTime() - candidate.lastRunAt.getTime() < cooldownMs
    ) {
      continue;
    }

    selected.push({
      id: candidate.id,
      userId: candidate.userId,
      projectId: candidate.projectId,
      spec,
    });
  }

  return selected;
}
