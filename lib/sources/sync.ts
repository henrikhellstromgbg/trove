import { storeUpload } from "@/lib/files";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Source } from "@/lib/db/schema";
import {
  classifyByNameAndType,
  contentTypeForKind,
  MAX_FILE_BYTES,
} from "@/lib/capture";
import { inngest } from "@/lib/inngest/client";
import { nextSourceRun } from "./schedule";
import { loadDeletedExternalIds } from "@/lib/review-or-deletion/import-guard";
import { summarizeActiveSourceRules } from "./contracts";
import {
  importedItemStatus,
  safeParseReviewRuleConfig,
  type ReviewRuleConfig,
} from "./review-rules";
import { fetchRssEntries } from "./rss";
import { downloadSlackFile, fetchSlackMessages, type SlackFile } from "./slack";
import { fetchWebScrapeEntries } from "./web-scrape";

export type SyncResult = {
  ok: boolean;
  newItems: number;
  newOriginals: number;
  error?: string;
  cursor?: unknown;
  code?: "already_running";
};

export type SourceRunTrigger = "manual" | "cron";

const ACTIVE_SOURCE_RUN_CONSTRAINT = "source_run_active_source_idx";
const ALREADY_RUNNING_ERROR = "source sync already running";

// On a *repeated* failure a source is pushed at least this far out instead of
// retrying at full cron cadence, so a persistently failing source (bad token,
// deleted channel) stops hammering the upstream API. A one-off blip keeps the
// normal schedule. Overridable; floored so it can't be turned off by a typo.
const SOURCE_ERROR_BACKOFF_ENV = "TROVE_SOURCE_ERROR_BACKOFF_SECS";
const DEFAULT_SOURCE_ERROR_BACKOFF_SECS = 3600;
const MIN_SOURCE_ERROR_BACKOFF_SECS = 60;

function sourceErrorBackoffMs(): number {
  const raw = process.env[SOURCE_ERROR_BACKOFF_ENV];
  const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN;
  const secs = Number.isFinite(parsed)
    ? Math.max(parsed, MIN_SOURCE_ERROR_BACKOFF_SECS)
    : DEFAULT_SOURCE_ERROR_BACKOFF_SECS;
  return secs * 1000;
}

// Normal cron cadence, except a repeated failure is delayed to at least
// completedAt + backoff (never earlier than the scheduled time).
export function nextRunAtWithBackoff(
  cron: string | null,
  completedAt: Date,
  failed: boolean,
  priorStatus: string | null | undefined
): Date | null {
  if (!cron) return null;
  const scheduled = sourceSyncDeps.nextRunFromCron(cron, completedAt);
  if (failed && priorStatus === "error") {
    const backedOff = new Date(completedAt.getTime() + sourceErrorBackoffMs());
    return !scheduled || backedOff > scheduled ? backedOff : scheduled;
  }
  return scheduled;
}

type SourceRunStartResult =
  | { started: true; sourceRunId: string; priorStatus: string | null }
  | { started: false; result: SyncResult };

type SyncDbClient = Pick<typeof db, "select" | "insert" | "update">;

type PendingItemInput = {
  externalId: string;
  type: "url" | "text" | "pdf" | "image" | "docx" | "xlsx" | "textfile";
  source: string | null;
  rawText?: string | null;
  blobUrl?: string | null;
  capturedAt?: Date | null;
};

type OriginalRecordInput = {
  externalId: string;
  itemId: string | null;
  contentType: string;
  sourceLabel: string | null;
  payload: Record<string, unknown>;
  capturedAt?: Date | null;
};

type PersistedSyncBatch = {
  newItems: number;
  newOriginals: number;
  insertedItemIds: string[];
};

// Only the fields sync actually reads. Kept narrow so callers can pass a row
// whose Date columns have been JSON-serialized to strings across an Inngest
// step boundary without a type mismatch.
export type SyncableSource = Pick<
  Source,
  "id" | "userId" | "projectId" | "kind" | "config" | "cursor" | "cron"
>;

export const sourceSyncDeps = {
  db,
  fetchRssEntries,
  fetchSlackMessages,
  fetchWebScrapeEntries,
  downloadSlackFile,
  storeUpload,
  // Keyed nextRunFromCron for back-compat (nextRunAtWithBackoff and test stubs
  // reference this), but bound to the source-local timezone.
  nextRunFromCron: (cron: string, from: Date = new Date()) =>
    nextSourceRun(cron, from),
  sendItemCaptured: async (itemId: string) => {
    await inngest.send({ name: "item/captured", data: { itemId } });
  },
};

export function planOriginalRecordVersions(
  existing: Array<{ externalId: string; version: number }>,
  externalIds: string[]
): number[] {
  const nextVersionByExternalId = new Map<string, number>();
  for (const row of existing) {
    nextVersionByExternalId.set(
      row.externalId,
      Math.max(nextVersionByExternalId.get(row.externalId) ?? 0, row.version)
    );
  }

  return externalIds.map((externalId) => {
    const nextVersion = (nextVersionByExternalId.get(externalId) ?? 0) + 1;
    nextVersionByExternalId.set(externalId, nextVersion);
    return nextVersion;
  });
}

async function insertOriginalVersions(
  dbClient: SyncDbClient,
  source: SyncableSource,
  sourceRunId: string,
  originals: OriginalRecordInput[]
): Promise<number> {
  if (originals.length === 0) return 0;

  const externalIds = Array.from(new Set(originals.map((original) => original.externalId)));
  const existing = await dbClient
    .select({
      externalId: schema.originalRecord.externalId,
      version: schema.originalRecord.version,
    })
    .from(schema.originalRecord)
    .where(
      and(
        eq(schema.originalRecord.sourceId, source.id),
        inArray(schema.originalRecord.externalId, externalIds)
      )
    );

  const versions = planOriginalRecordVersions(
    existing,
    originals.map((original) => original.externalId)
  );

  const inserted = await dbClient
    .insert(schema.originalRecord)
    .values(
      originals.map((original, index) => ({
        userId: source.userId,
        projectId: source.projectId,
        sourceId: source.id,
        sourceRunId,
        itemId: original.itemId,
        externalId: original.externalId,
        version: versions[index],
        contentType: original.contentType,
        sourceLabel: original.sourceLabel,
        payload: original.payload,
        ...(original.capturedAt ? { capturedAt: original.capturedAt } : {}),
      }))
    )
    .returning({ id: schema.originalRecord.id });

  return inserted.length;
}

// The active, version-bound, project-scoped review rule for a source, if any.
// Only the highest-version enabled review rule applies; a corrupt stored config
// is treated as no rule so it can never wedge ingestion.
export async function loadActiveReviewRuleConfig(
  reader: Pick<SyncDbClient, "select">,
  sourceId: string,
  projectId: string
): Promise<ReviewRuleConfig | null> {
  const rows = await reader
    .select({
      id: schema.sourceRule.id,
      version: schema.sourceRule.version,
      ruleType: schema.sourceRule.ruleType,
      enabled: schema.sourceRule.enabled,
      config: schema.sourceRule.config,
    })
    .from(schema.sourceRule)
    .where(
      and(
        eq(schema.sourceRule.sourceId, sourceId),
        eq(schema.sourceRule.projectId, projectId),
        eq(schema.sourceRule.ruleType, "review"),
        eq(schema.sourceRule.enabled, true)
      )
    );

  const active = summarizeActiveSourceRules(
    rows as Array<{ id: string; version: number; ruleType: string; enabled: boolean; config: unknown }>
  ).review;
  return active ? safeParseReviewRuleConfig(active.config) : null;
}

async function loadItemIdByExternalId(
  dbClient: SyncDbClient,
  sourceId: string,
  externalIds: string[]
): Promise<Map<string, string>> {
  if (externalIds.length === 0) return new Map();

  const existing = await dbClient
    .select({ id: schema.item.id, externalId: schema.item.externalId })
    .from(schema.item)
    .where(
      and(eq(schema.item.sourceId, sourceId), inArray(schema.item.externalId, externalIds))
    );

  return new Map(
    existing
      .filter((row): row is { id: string; externalId: string } => row.externalId != null)
      .map((row) => [row.externalId, row.id])
  );
}

async function persistSyncBatch(
  source: SyncableSource,
  sourceRunId: string,
  items: PendingItemInput[],
  originals: Omit<OriginalRecordInput, "itemId">[]
): Promise<PersistedSyncBatch> {
  if (originals.length === 0) {
    return { newItems: 0, newOriginals: 0, insertedItemIds: [] };
  }

  return sourceSyncDeps.db.transaction(async (tx) => {
    const originalExternalIds = Array.from(
      new Set(originals.map((original) => original.externalId))
    );
    const deletedExternalIds = await loadDeletedExternalIds(
      tx,
      source.projectId,
      source.id,
      originalExternalIds
    );
    const allowedOriginals = originals.filter(
      (original) => !deletedExternalIds.has(original.externalId)
    );
    const allowedItems = items.filter((item) => !deletedExternalIds.has(item.externalId));

    if (allowedOriginals.length === 0) {
      return { newItems: 0, newOriginals: 0, insertedItemIds: [] };
    }

    const externalIds = Array.from(
      new Set(allowedOriginals.map((original) => original.externalId))
    );
    const itemIdByExternalId = await loadItemIdByExternalId(tx, source.id, externalIds);

    // An active review rule holds matching items in the review queue: they are
    // persisted (with their immutable original) but never emitted, so they get
    // no chunks and cannot be reached by Ask until approved.
    const reviewConfig = await loadActiveReviewRuleConfig(tx, source.id, source.projectId);

    const freshItems = allowedItems.filter((item) => !itemIdByExternalId.has(item.externalId));
    const inserted =
      freshItems.length > 0
        ? await tx
            .insert(schema.item)
            .values(
              freshItems.map((item) => ({
                userId: source.userId,
                projectId: source.projectId,
                sourceId: source.id,
                externalId: item.externalId,
                type: item.type,
                source: item.source,
                ...(item.rawText != null ? { rawText: item.rawText } : {}),
                ...(item.blobUrl != null ? { blobUrl: item.blobUrl } : {}),
                status: importedItemStatus(reviewConfig, {
                  source: item.source,
                  text: item.rawText ?? null,
                }),
                ...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
              }))
            )
            .onConflictDoNothing()
            .returning({
              id: schema.item.id,
              externalId: schema.item.externalId,
            })
        : [];

    for (const row of inserted) {
      if (row.externalId) itemIdByExternalId.set(row.externalId, row.id);
    }

    const missingExternalIds = externalIds.filter(
      (externalId) => !itemIdByExternalId.has(externalId)
    );
    if (missingExternalIds.length > 0) {
      const reloaded = await loadItemIdByExternalId(tx, source.id, missingExternalIds);
      for (const [externalId, itemId] of reloaded) {
        itemIdByExternalId.set(externalId, itemId);
      }
    }

    const newOriginals = await insertOriginalVersions(
      tx,
      source,
      sourceRunId,
      allowedOriginals.map((original) => ({
        ...original,
        itemId: itemIdByExternalId.get(original.externalId) ?? null,
      }))
    );

    const pendingItems = await tx
      .select({ id: schema.item.id })
      .from(schema.item)
      .where(
        and(
          eq(schema.item.sourceId, source.id),
          inArray(schema.item.externalId, externalIds),
          eq(schema.item.status, "pending")
        )
      );

    return {
      newItems: inserted.length,
      newOriginals,
      insertedItemIds: pendingItems.map((row) => row.id),
    };
  });
}

async function emitCapturedItems(itemIds: string[]): Promise<string | undefined> {
  try {
    for (const itemId of itemIds) {
      await sourceSyncDeps.sendItemCaptured(itemId);
    }
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "unknown item/captured send error";
  }
}

function alreadyRunningResult(): SyncResult {
  return {
    ok: false,
    newItems: 0,
    newOriginals: 0,
    error: ALREADY_RUNNING_ERROR,
    code: "already_running",
  };
}

function isActiveSourceRunConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    code?: string;
    constraint?: string;
    message?: string;
    cause?: unknown;
  };

  if (
    maybeError.code === "23505" &&
    (maybeError.constraint === ACTIVE_SOURCE_RUN_CONSTRAINT ||
      maybeError.message?.includes(ACTIVE_SOURCE_RUN_CONSTRAINT))
  ) {
    return true;
  }

  return isActiveSourceRunConflict(maybeError.cause);
}

async function syncRss(
  source: SyncableSource,
  sourceRunId: string
): Promise<SyncResult> {
  const config = source.config as { feedUrl?: string };
  if (!config.feedUrl) {
    return {
      ok: false,
      newItems: 0,
      newOriginals: 0,
      error: "missing feedUrl in source config",
    };
  }

  const entries = await sourceSyncDeps.fetchRssEntries(config.feedUrl);
  if (entries.length === 0) return { ok: true, newItems: 0, newOriginals: 0 };

  const persisted = await persistSyncBatch(
    source,
    sourceRunId,
    entries.map((entry) => ({
      externalId: entry.externalId,
      type: "url",
      source: entry.url,
      capturedAt: entry.publishedAt,
    })),
    entries.map((entry) => ({
      externalId: entry.externalId,
      contentType: "application/rss+json",
      sourceLabel: entry.url,
      payload: {
        kind: "rss",
        title: entry.title,
        url: entry.url,
        publishedAt: entry.publishedAt?.toISOString() ?? null,
      },
      capturedAt: entry.publishedAt,
    }))
  );

  const eventError = await emitCapturedItems(persisted.insertedItemIds);
  if (eventError) {
    return {
      ok: false,
      newItems: persisted.newItems,
      newOriginals: persisted.newOriginals,
      error: eventError,
    };
  }

  return {
    ok: true,
    newItems: persisted.newItems,
    newOriginals: persisted.newOriginals,
  };
}

async function syncWebScrape(
  source: SyncableSource,
  sourceRunId: string
): Promise<SyncResult> {
  const config = source.config as {
    url?: string;
    selector?: string;
    followLinks?: boolean;
  };
  if (!config.url) {
    return {
      ok: false,
      newItems: 0,
      newOriginals: 0,
      error: "missing url in source config",
    };
  }

  const entries = await sourceSyncDeps.fetchWebScrapeEntries(config.url, {
    selector: config.selector,
    followLinks: config.followLinks,
  });
  if (entries.length === 0) return { ok: true, newItems: 0, newOriginals: 0 };

  const persisted = await persistSyncBatch(
    source,
    sourceRunId,
    entries.map((entry) => ({
      externalId: entry.externalId,
      type: "url",
      source: entry.url,
    })),
    entries.map((entry) => ({
      externalId: entry.externalId,
      contentType: "application/json",
      sourceLabel: entry.url,
      payload: {
        kind: "web_scrape",
        title: entry.title,
        url: entry.url,
      },
    }))
  );

  const eventError = await emitCapturedItems(persisted.insertedItemIds);
  if (eventError) {
    return {
      ok: false,
      newItems: persisted.newItems,
      newOriginals: persisted.newOriginals,
      error: eventError,
    };
  }

  return {
    ok: true,
    newItems: persisted.newItems,
    newOriginals: persisted.newOriginals,
  };
}

type SlackFileBatch = {
  items: PendingItemInput[];
  originals: Omit<OriginalRecordInput, "itemId">[];
};

// Download shared files and stage them as file items. Fresh files only (already
// imported ids are pre-filtered so no orphan blob is uploaded at the cursor
// boundary), classifiable kinds only, and within the size cap. A per-file
// download/upload failure is logged and skipped so one bad file never fails the
// whole sync.
async function prepareSlackFileBatch(
  source: SyncableSource,
  files: SlackFile[],
  provenance: Record<string, unknown>,
  channelId: string
): Promise<SlackFileBatch> {
  const batch: SlackFileBatch = { items: [], originals: [] };
  if (files.length === 0) return batch;

  const alreadyImported = await loadItemIdByExternalId(
    sourceSyncDeps.db,
    source.id,
    files.map((f) => f.externalId)
  );

  for (const file of files) {
    if (alreadyImported.has(file.externalId)) continue;

    if (file.size > MAX_FILE_BYTES) {
      console.warn(
        `slack file skipped (too large: ${file.size} bytes): ${file.name}`
      );
      continue;
    }

    const kind = classifyByNameAndType(file.name, file.mimeType);
    if (!kind) {
      console.warn(`slack file skipped (unsupported type): ${file.name}`);
      continue;
    }

    let blobUrl: string;
    try {
      const bytes = await sourceSyncDeps.downloadSlackFile(file.urlPrivate);
      const stored = await sourceSyncDeps.storeUpload(file.name, bytes);
      blobUrl = stored.key;
    } catch (error) {
      console.warn(
        `slack file skipped (download/upload failed): ${file.name}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      continue;
    }

    batch.items.push({
      externalId: file.externalId,
      type: kind,
      source: file.name, // the extractor reads this as the filename
      blobUrl,
      capturedAt: file.postedAt,
    });
    batch.originals.push({
      externalId: file.externalId,
      contentType: contentTypeForKind(kind, file.mimeType),
      sourceLabel: channelId,
      payload: {
        ...provenance,
        kind: "slack_file",
        fileId: file.externalId,
        name: file.name,
        size: file.size,
        ...(file.threadTs ? { threadTs: file.threadTs } : {}),
      },
      capturedAt: file.postedAt,
    });
  }

  return batch;
}

async function syncSlack(
  source: SyncableSource,
  sourceRunId: string
): Promise<SyncResult> {
  const config = source.config as {
    channelId?: string;
    teamId?: string;
    mode?: "poll" | "events";
  };
  if (!config.channelId) {
    return {
      ok: false,
      newItems: 0,
      newOriginals: 0,
      error: "missing channelId in source config",
    };
  }

  // conversations.history works for any channel the bot can read, so poll is the
  // delivery path for both modes today; `mode` is recorded as provenance until
  // the Events webhook exists. `teamId` disambiguates the channel across
  // workspaces and travels with each captured original.
  const mode = config.mode ?? "poll";

  const cursor = source.cursor as { latestTs?: string } | null;

  let result;
  try {
    result = await sourceSyncDeps.fetchSlackMessages(config.channelId, cursor?.latestTs);
  } catch (error) {
    return {
      ok: false,
      newItems: 0,
      newOriginals: 0,
      error: error instanceof Error ? error.message : "unknown Slack API error",
    };
  }

  const nextCursor = result.latestTs ? { latestTs: result.latestTs } : cursor ?? undefined;
  const files = result.files ?? [];
  if (result.messages.length === 0 && files.length === 0) {
    return { ok: true, newItems: 0, newOriginals: 0, cursor: nextCursor };
  }

  const provenance: Record<string, unknown> = {
    channelId: config.channelId,
    mode,
    ...(config.teamId ? { teamId: config.teamId } : {}),
  };

  const fileBatch = await prepareSlackFileBatch(
    source,
    files,
    provenance,
    config.channelId
  );

  const persisted = await persistSyncBatch(
    source,
    sourceRunId,
    [
      ...result.messages.map((message) => ({
        externalId: message.externalId,
        type: "text" as const,
        source: null,
        rawText: message.text,
        capturedAt: message.postedAt,
      })),
      ...fileBatch.items,
    ],
    [
      ...result.messages.map((message) => ({
        externalId: message.externalId,
        contentType: "application/json",
        sourceLabel: config.channelId ?? null,
        payload: {
          ...provenance,
          kind: "slack_channel",
          ...(message.threadTs ? { threadTs: message.threadTs } : {}),
          text: message.text,
          postedAt: message.postedAt.toISOString(),
        },
        capturedAt: message.postedAt,
      })),
      ...fileBatch.originals,
    ]
  );

  const eventError = await emitCapturedItems(persisted.insertedItemIds);
  if (eventError) {
    return {
      ok: false,
      newItems: persisted.newItems,
      newOriginals: persisted.newOriginals,
      error: eventError,
    };
  }

  return {
    ok: true,
    newItems: persisted.newItems,
    newOriginals: persisted.newOriginals,
    cursor: nextCursor,
  };
}

// Dispatches by source kind. youtube_channel still needs an API key (see
// docs/architecture-v2.md) before it can be added here.
export async function syncSource(
  source: SyncableSource,
  sourceRunId: string
): Promise<SyncResult> {
  if (source.kind === "rss") return syncRss(source, sourceRunId);
  if (source.kind === "web_scrape") return syncWebScrape(source, sourceRunId);
  if (source.kind === "slack_channel") return syncSlack(source, sourceRunId);
  return {
    ok: false,
    newItems: 0,
    newOriginals: 0,
    error: `sync not implemented for kind "${source.kind}"`,
  };
}

export async function startSourceRun(
  source: SyncableSource,
  trigger: SourceRunTrigger
): Promise<SourceRunStartResult> {
  try {
    return await sourceSyncDeps.db.transaction(async (tx) => {
      // Read the outgoing status before overwriting it with "running", so the
      // result recorder can tell a repeated failure from a first one.
      const priorRows = await tx
        .select({ lastStatus: schema.source.lastStatus })
        .from(schema.source)
        .where(eq(schema.source.id, source.id));
      const priorStatus = (priorRows[0]?.lastStatus as string | null) ?? null;

      const [run] = await tx
        .insert(schema.sourceRun)
        .values({
          userId: source.userId,
          projectId: source.projectId,
          sourceId: source.id,
          trigger,
          status: "running",
          cursorBefore: source.cursor ?? null,
        })
        .returning({ id: schema.sourceRun.id });

      await tx
        .update(schema.source)
        .set({
          lastStatus: "running",
          lastError: null,
        })
        .where(eq(schema.source.id, source.id));

      return { started: true, sourceRunId: run.id, priorStatus };
    });
  } catch (error) {
    if (isActiveSourceRunConflict(error)) {
      return { started: false, result: alreadyRunningResult() };
    }
    throw error;
  }
}

export async function recordSyncResult(
  source: SyncableSource,
  sourceRunId: string,
  result: SyncResult,
  priorStatus: string | null
) {
  const completedAt = new Date();

  await sourceSyncDeps.db.transaction(async (tx) => {
    await tx
      .update(schema.sourceRun)
      .set({
        status: result.ok ? "ok" : "error",
        cursorAfter: result.cursor ?? source.cursor ?? null,
        itemCount: result.newItems,
        originalCount: result.newOriginals,
        error: result.ok ? null : result.error ?? "unknown error",
        completedAt,
      })
      .where(eq(schema.sourceRun.id, sourceRunId));

    await tx
      .update(schema.source)
      .set({
        lastSyncAt: completedAt,
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.ok ? null : result.error ?? "unknown error",
        nextRunAt: nextRunAtWithBackoff(
          source.cron,
          completedAt,
          !result.ok,
          priorStatus
        ),
        ...(result.cursor !== undefined ? { cursor: result.cursor } : {}),
      })
      .where(eq(schema.source.id, source.id));
  });
}

export async function runSourceSync(
  source: SyncableSource,
  trigger: SourceRunTrigger
): Promise<SyncResult> {
  const started = await startSourceRun(source, trigger);
  if (!started.started) return started.result;

  const sourceRunId = started.sourceRunId;

  let result: SyncResult;
  try {
    result = await syncSource(source, sourceRunId);
  } catch (error) {
    result = {
      ok: false,
      newItems: 0,
      newOriginals: 0,
      error: error instanceof Error ? error.message : "unknown sync error",
    };
  }

  await recordSyncResult(source, sourceRunId, result, started.priorStatus);
  return result;
}
