import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import type { Source } from "@/lib/db/schema";
import { fetchRssEntries } from "./rss";

export type SyncResult = {
  ok: boolean;
  newItems: number;
  error?: string;
};

// Only the fields sync actually reads. Kept narrow so callers can pass a row
// whose Date columns have been JSON-serialized to strings across an Inngest
// step boundary without a type mismatch.
type SyncableSource = Pick<
  Source,
  "id" | "userId" | "projectId" | "kind" | "config"
>;

async function syncRss(source: SyncableSource): Promise<SyncResult> {
  const config = source.config as { feedUrl?: string };
  if (!config.feedUrl) {
    return { ok: false, newItems: 0, error: "missing feedUrl in source config" };
  }

  const entries = await fetchRssEntries(config.feedUrl);
  if (entries.length === 0) return { ok: true, newItems: 0 };

  const existing = await db
    .select({ externalId: schema.item.externalId })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.sourceId, source.id),
        inArray(
          schema.item.externalId,
          entries.map((e) => e.externalId)
        )
      )
    );
  const seen = new Set(existing.map((r) => r.externalId));

  const fresh = entries.filter((e) => !seen.has(e.externalId));
  if (fresh.length === 0) return { ok: true, newItems: 0 };

  const inserted = await db
    .insert(schema.item)
    .values(
      fresh.map((e) => ({
        userId: source.userId,
        projectId: source.projectId as string,
        sourceId: source.id,
        externalId: e.externalId,
        type: "url",
        source: e.url,
        status: "pending",
        ...(e.publishedAt ? { capturedAt: e.publishedAt } : {}),
      }))
    )
    .onConflictDoNothing()
    .returning({ id: schema.item.id });

  for (const row of inserted) {
    await inngest.send({ name: "item/captured", data: { itemId: row.id } });
  }

  return { ok: true, newItems: inserted.length };
}

// Dispatches by source kind. Only "rss" is implemented so far — youtube_channel,
// web_scrape and slack_channel need their own fetchers (and, for youtube, an API
// key) before they can be added here. See docs/architecture-v2.md, Phase 4/6.
export async function syncSource(source: SyncableSource): Promise<SyncResult> {
  if (!source.projectId) {
    return { ok: false, newItems: 0, error: "source has no project_id" };
  }
  if (source.kind === "rss") return syncRss(source);
  return {
    ok: false,
    newItems: 0,
    error: `sync not implemented for kind "${source.kind}"`,
  };
}

export async function recordSyncResult(
  sourceId: string,
  result: SyncResult,
  cron: string | null
) {
  await db
    .update(schema.source)
    .set({
      lastSyncAt: new Date(),
      lastStatus: result.ok ? "ok" : "error",
      lastError: result.ok ? null : result.error ?? "unknown error",
      nextRunAt: cron ? nextRunFromCron(cron, new Date()) : null,
    })
    .where(eq(schema.source.id, sourceId));
}
