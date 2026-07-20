import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import type { Source } from "@/lib/db/schema";
import { fetchRssEntries } from "./rss";
import { fetchWebScrapeEntries } from "./web-scrape";
import { fetchSlackMessages } from "./slack";

export type SyncResult = {
  ok: boolean;
  newItems: number;
  error?: string;
  cursor?: unknown;
};

// Only the fields sync actually reads. Kept narrow so callers can pass a row
// whose Date columns have been JSON-serialized to strings across an Inngest
// step boundary without a type mismatch.
type SyncableSource = Pick<
  Source,
  "id" | "userId" | "projectId" | "kind" | "config" | "cursor"
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

async function syncWebScrape(source: SyncableSource): Promise<SyncResult> {
  const config = source.config as { url?: string; selector?: string; followLinks?: boolean };
  if (!config.url) {
    return { ok: false, newItems: 0, error: "missing url in source config" };
  }

  const entries = await fetchWebScrapeEntries(config.url, {
    selector: config.selector,
    followLinks: config.followLinks,
  });
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
      }))
    )
    .onConflictDoNothing()
    .returning({ id: schema.item.id });

  for (const row of inserted) {
    await inngest.send({ name: "item/captured", data: { itemId: row.id } });
  }

  return { ok: true, newItems: inserted.length };
}

async function syncSlack(source: SyncableSource): Promise<SyncResult> {
  const config = source.config as { channelId?: string };
  if (!config.channelId) {
    return { ok: false, newItems: 0, error: "missing channelId in source config" };
  }

  const cursor = source.cursor as { latestTs?: string } | null;

  let result;
  try {
    result = await fetchSlackMessages(config.channelId, cursor?.latestTs);
  } catch (err) {
    return {
      ok: false,
      newItems: 0,
      error: err instanceof Error ? err.message : "unknown Slack API error",
    };
  }

  const nextCursor = result.latestTs ? { latestTs: result.latestTs } : cursor ?? undefined;

  if (result.messages.length === 0) {
    return { ok: true, newItems: 0, cursor: nextCursor };
  }

  const inserted = await db
    .insert(schema.item)
    .values(
      result.messages.map((m) => ({
        userId: source.userId,
        projectId: source.projectId as string,
        sourceId: source.id,
        externalId: m.externalId,
        type: "text",
        rawText: m.text,
        status: "pending",
        capturedAt: m.postedAt,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: schema.item.id });

  for (const row of inserted) {
    await inngest.send({ name: "item/captured", data: { itemId: row.id } });
  }

  return { ok: true, newItems: inserted.length, cursor: nextCursor };
}

// Dispatches by source kind. youtube_channel still needs an API key (see
// docs/architecture-v2.md) before it can be added here.
export async function syncSource(source: SyncableSource): Promise<SyncResult> {
  if (!source.projectId) {
    return { ok: false, newItems: 0, error: "source has no project_id" };
  }
  if (source.kind === "rss") return syncRss(source);
  if (source.kind === "web_scrape") return syncWebScrape(source);
  if (source.kind === "slack_channel") return syncSlack(source);
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
      ...(result.cursor !== undefined ? { cursor: result.cursor } : {}),
    })
    .where(eq(schema.source.id, sourceId));
}
