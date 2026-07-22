import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { schema } from "@/lib/db";
import {
  runSourceSync,
  sourceSyncDeps,
  type SyncableSource,
} from "@/lib/sources/sync";

type MutableDeps = Record<string, unknown>;
type TableRow = Record<string, unknown>;

type DbState = {
  sources: TableRow[];
  sourceRules: TableRow[];
  sourceRuns: TableRow[];
  items: TableRow[];
  originals: TableRow[];
  deletionMarkers: TableRow[];
};

const SOURCE: SyncableSource = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: "user-a",
  projectId: "11111111-1111-4111-8111-111111111111",
  kind: "rss",
  config: { feedUrl: "https://example.com/feed.xml" },
  cursor: null,
  cron: "0 * * * *",
};

const NEXT_RUN = new Date("2026-07-21T11:00:00.000Z");

const originalDeps = { ...sourceSyncDeps };

function tableName(table: unknown): keyof DbState {
  if (table === schema.source) return "sources";
  if (table === schema.sourceRule) return "sourceRules";
  if (table === schema.sourceRun) return "sourceRuns";
  if (table === schema.item) return "items";
  if (table === schema.originalRecord) return "originals";
  if (table === schema.deletionMarker) return "deletionMarkers";
  throw new Error("unexpected table");
}

function cloneState(state: DbState): DbState {
  return structuredClone(state);
}

function projectRows(rows: TableRow[], fields?: Record<string, { name: string }>) {
  if (!fields) return rows;
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(fields)) {
      projected[key] = row[key] ?? row[column.name];
    }
    return projected;
  });
}

class MockSyncDb {
  state: DbState;
  log: string[] = [];
  failOriginalInsert = false;
  private sourceRunSeq = 1;
  private itemSeq = 1;
  private originalSeq = 1;
  private txSeq = 1;

  constructor(initial?: Partial<DbState>) {
    this.state = {
      sources: initial?.sources ?? [],
      sourceRules: initial?.sourceRules ?? [],
      sourceRuns: initial?.sourceRuns ?? [],
      items: initial?.items ?? [],
      originals: initial?.originals ?? [],
      deletionMarkers: initial?.deletionMarkers ?? [],
    };
  }

  async transaction<T>(callback: (tx: SyncDbClientLike) => Promise<T>): Promise<T> {
    const txId = this.txSeq++;
    const snapshot = cloneState(this.state);
    this.log.push(`tx:${txId}:begin`);
    const tx = this.makeClient(snapshot);

    try {
      const result = await callback(tx);
      this.state = snapshot;
      this.log.push(`tx:${txId}:commit`);
      return result;
    } catch (error) {
      this.log.push(`tx:${txId}:rollback`);
      throw error;
    }
  }

  select(fields?: Record<string, { name: string }>) {
    return this.makeClient(this.state).select(fields);
  }

  insert(table: unknown) {
    return this.makeClient(this.state).insert(table);
  }

  update(table: unknown) {
    return this.makeClient(this.state).update(table);
  }

  private makeClient(state: DbState) {
    return {
      select: (fields?: Record<string, { name: string }>) => {
        let selectedTable: keyof DbState | null = null;
        const chain = {
          from: (table: unknown) => {
            selectedTable = tableName(table);
            return chain;
          },
          where: async () => {
            if (!selectedTable) throw new Error("select table missing");
            let rows = state[selectedTable];
            // The pending-item re-query (which decides what gets emitted)
            // selects only { id }. Honour its status='pending' filter so held
            // review items are correctly excluded from emission; every other
            // item query selects externalId too and wants all rows.
            if (
              selectedTable === "items" &&
              fields &&
              "id" in fields &&
              !("externalId" in fields)
            ) {
              rows = rows.filter((row) => row.status === "pending");
            }
            return projectRows(rows, fields);
          },
        };
        return chain;
      },
      insert: (table: unknown) => {
        const target = tableName(table);
        let values: TableRow[] = [];
        let ignoreConflicts = false;

        const chain = {
          values: (input: TableRow | TableRow[]) => {
            values = Array.isArray(input) ? input : [input];
            return chain;
          },
          onConflictDoNothing: () => {
            ignoreConflicts = true;
            return chain;
          },
          returning: async (fields?: Record<string, { name: string }>) => {
            const inserted = this.applyInsert(state, target, values, ignoreConflicts);
            return projectRows(inserted, fields);
          },
        };

        return chain;
      },
      update: (table: unknown) => {
        const target = tableName(table);
        let values: TableRow = {};

        const chain = {
          set: (nextValues: TableRow) => {
            values = nextValues;
            return chain;
          },
          where: async () => {
            for (const row of state[target]) {
              Object.assign(row, values);
            }
            return [];
          },
        };

        return chain;
      },
    };
  }

  private applyInsert(
    state: DbState,
    target: keyof DbState,
    values: TableRow[],
    ignoreConflicts: boolean
  ): TableRow[] {
    if (target === "sourceRuns") {
      return values.map((value) => {
        const sourceId = value.sourceId as string;
        if (
          value.status === "running" &&
          state.sourceRuns.some(
            (row) => row.sourceId === sourceId && row.status === "running"
          )
        ) {
          throw Object.assign(new Error("source_run_active_source_idx"), {
            code: "23505",
            constraint: "source_run_active_source_idx",
          });
        }

        const row = {
          id: `run-${this.sourceRunSeq++}`,
          itemCount: 0,
          originalCount: 0,
          error: null,
          startedAt: new Date("2026-07-21T10:00:00.000Z"),
          completedAt: null,
          ...value,
        };
        state.sourceRuns.push(row);
        return row;
      });
    }

    if (target === "items") {
      const inserted: TableRow[] = [];
      for (const value of values) {
        const sourceId = value.sourceId as string | null;
        const externalId = value.externalId as string | null;
        const conflict = state.items.some(
          (row) => row.sourceId === sourceId && row.externalId === externalId
        );
        if (conflict) {
          if (ignoreConflicts) continue;
          throw new Error("item unique conflict");
        }

        const row = {
          id: `item-${this.itemSeq++}`,
          rawText: null,
          capturedAt: new Date("2026-07-21T10:00:00.000Z"),
          ...value,
        };
        state.items.push(row);
        inserted.push(row);
      }
      return inserted;
    }

    if (target === "originals") {
      if (this.failOriginalInsert) {
        throw new Error("original insert failed");
      }

      const inserted: TableRow[] = [];
      for (const value of values) {
        const conflict = state.originals.some(
          (row) =>
            row.sourceId === value.sourceId &&
            row.externalId === value.externalId &&
            row.version === value.version
        );
        if (conflict) throw new Error("original version conflict");

        const row = {
          id: `original-${this.originalSeq++}`,
          createdAt: new Date("2026-07-21T10:00:00.000Z"),
          capturedAt: new Date("2026-07-21T10:00:00.000Z"),
          ...value,
        };
        state.originals.push(row);
        inserted.push(row);
      }
      return inserted;
    }

    throw new Error(`unsupported insert target: ${target}`);
  }
}

type SyncDbClientLike = Pick<MockSyncDb, "select" | "insert" | "update">;

beforeEach(() => {
  Object.assign(sourceSyncDeps as unknown as MutableDeps, originalDeps, {
    nextRunFromCron: () => NEXT_RUN,
  });
});

afterEach(() => {
  Object.assign(sourceSyncDeps as unknown as MutableDeps, originalDeps);
});

test("runSourceSync returns already_running without side effects", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: "running", lastError: null }],
    sourceRuns: [{ id: "run-existing", sourceId: SOURCE.id, status: "running" }],
  });

  let fetchCalls = 0;
  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => {
      fetchCalls += 1;
      return [];
    },
  });

  const result = await runSourceSync(SOURCE, "manual");

  assert.equal(result.ok, false);
  assert.equal(result.code, "already_running");
  assert.equal(result.error, "source sync already running");
  assert.equal(fetchCalls, 0);
  assert.equal(db.state.sourceRuns.length, 1);
  assert.equal(db.state.sources[0]?.lastStatus, "running");
});

test("runSourceSync emits item/captured only after the item and original commit", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: null, lastError: null }],
  });

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => [
      {
        externalId: "entry-1",
        title: "Entry one",
        url: "https://example.com/entry-1",
        publishedAt: new Date("2026-07-21T09:00:00.000Z"),
      },
    ],
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SOURCE, "manual");

  assert.equal(result.ok, true);
  assert.equal(result.newItems, 1);
  assert.equal(result.newOriginals, 1);
  assert.equal(db.state.items.length, 1);
  assert.equal(db.state.originals.length, 1);
  assert.equal(db.state.originals[0]?.itemId, db.state.items[0]?.id);
  assert.equal(db.state.sourceRuns[0]?.status, "ok");
  assert.equal(db.state.sources[0]?.lastStatus, "ok");
  assert.equal(db.state.sources[0]?.nextRunAt, NEXT_RUN);

  const persistCommitIndex = db.log.indexOf("tx:2:commit");
  const eventIndex = db.log.indexOf("event:item-1");
  assert.notEqual(persistCommitIndex, -1);
  assert.notEqual(eventIndex, -1);
  assert.ok(persistCommitIndex < eventIndex);
});

test("runSourceSync rolls back item creation when original persistence fails and closes statuses", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: null, lastError: null }],
  });
  db.failOriginalInsert = true;

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => [
      {
        externalId: "entry-1",
        title: "Entry one",
        url: "https://example.com/entry-1",
        publishedAt: new Date("2026-07-21T09:00:00.000Z"),
      },
    ],
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SOURCE, "manual");

  assert.equal(result.ok, false);
  assert.equal(result.error, "original insert failed");
  assert.equal(result.newItems, 0);
  assert.equal(result.newOriginals, 0);
  assert.equal(db.state.items.length, 0);
  assert.equal(db.state.originals.length, 0);
  assert.equal(db.state.sourceRuns[0]?.status, "error");
  assert.equal(db.state.sourceRuns[0]?.completedAt instanceof Date, true);
  assert.equal(db.state.sources[0]?.lastStatus, "error");
  assert.equal(db.state.sources[0]?.lastError, "original insert failed");
  assert.equal(db.log.some((entry) => entry.startsWith("event:")), false);
});

test("runSourceSync retries capture events for existing pending items", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: "error", lastError: "event failed" }],
    items: [
      {
        id: "item-existing",
        sourceId: SOURCE.id,
        externalId: "entry-1",
        status: "pending",
      },
    ],
    originals: [
      {
        id: "original-existing",
        sourceId: SOURCE.id,
        externalId: "entry-1",
        version: 1,
      },
    ],
  });

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => [
      {
        externalId: "entry-1",
        title: "Entry one",
        url: "https://example.com/entry-1",
        publishedAt: new Date("2026-07-21T09:00:00.000Z"),
      },
    ],
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SOURCE, "cron");

  assert.equal(result.ok, true);
  assert.equal(result.newItems, 0);
  assert.equal(result.newOriginals, 1);
  assert.equal(db.state.originals.at(-1)?.version, 2);
  assert.equal(db.log.includes("event:item-existing"), true);
});

test("Slack sync keeps its cursor behind until item/captured succeeds", async () => {
  const source: SyncableSource = {
    ...SOURCE,
    kind: "slack_channel",
    config: { channelId: "channel-a", teamId: "T123", mode: "events" },
    cursor: null,
  };
  const db = new MockSyncDb({
    sources: [{ id: source.id, cursor: null, lastStatus: null, lastError: null }],
  });
  let sendAttempts = 0;

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchSlackMessages: async (_channelId: string, latestTs?: string) => {
      assert.equal(latestTs, undefined);
      return {
        latestTs: "1721552400.000100",
        messages: [
          {
            externalId: "1721552400.000100",
            text: "Selection notes",
            postedAt: new Date("2026-07-21T09:00:00.000Z"),
          },
        ],
      };
    },
    sendItemCaptured: async () => {
      sendAttempts += 1;
      if (sendAttempts === 1) throw new Error("event unavailable");
    },
  });

  const first = await runSourceSync(source, "cron");
  assert.equal(first.ok, false);
  assert.equal(db.state.sources[0]?.cursor, null);

  const second = await runSourceSync(source, "cron");
  assert.equal(second.ok, true);
  assert.deepEqual(db.state.sources[0]?.cursor, {
    latestTs: "1721552400.000100",
  });
  assert.equal(db.state.items.length, 1);
  assert.equal(sendAttempts, 2);

  // teamId and mode travel with the captured original as provenance.
  const payload = db.state.originals[0]?.payload as Record<string, unknown>;
  assert.equal(payload.channelId, "channel-a");
  assert.equal(payload.teamId, "T123");
  assert.equal(payload.mode, "events");
});

test("an active review rule holds matching items and never emits them", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: null, lastError: null }],
    sourceRules: [
      // Superseded selection rule and an older disabled review rule must be
      // ignored in favour of the highest-version enabled review rule.
      {
        id: "rule-old",
        sourceId: SOURCE.id,
        projectId: SOURCE.projectId,
        version: 1,
        ruleType: "review",
        enabled: false,
        config: { mode: "all", contains: [] },
      },
      {
        id: "rule-active",
        sourceId: SOURCE.id,
        projectId: SOURCE.projectId,
        version: 2,
        ruleType: "review",
        enabled: true,
        config: { mode: "match", contains: ["fresh"] },
      },
    ],
  });

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => [
      {
        externalId: "held-entry",
        title: "Held entry",
        url: "https://example.com/fresh-drop",
        publishedAt: new Date("2026-07-21T09:00:00.000Z"),
      },
      {
        externalId: "pending-entry",
        title: "Pending entry",
        url: "https://example.com/routine",
        publishedAt: new Date("2026-07-21T09:05:00.000Z"),
      },
    ],
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SOURCE, "manual");

  assert.equal(result.ok, true);
  assert.equal(result.newItems, 2);
  assert.equal(result.newOriginals, 2);

  const held = db.state.items.find((row) => row.externalId === "held-entry");
  const routine = db.state.items.find((row) => row.externalId === "pending-entry");
  assert.equal(held?.status, "review");
  assert.equal(routine?.status, "pending");

  // Immutable originals are still recorded for both, but only the pending item
  // is emitted for processing.
  assert.equal(db.state.originals.length, 2);
  const emitted = db.log.filter((entry) => entry.startsWith("event:"));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0], `event:${routine?.id}`);
});

test("runSourceSync skips external ids blocked by deletion markers", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SOURCE.id, lastStatus: null, lastError: null }],
    deletionMarkers: [
      {
        id: "marker-1",
        userId: SOURCE.userId,
        projectId: SOURCE.projectId,
        sourceId: SOURCE.id,
        externalId: "blocked-entry",
      },
    ],
  });

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchRssEntries: async () => [
      {
        externalId: "blocked-entry",
        title: "Blocked entry",
        url: "https://example.com/blocked",
        publishedAt: new Date("2026-07-21T09:00:00.000Z"),
      },
      {
        externalId: "fresh-entry",
        title: "Fresh entry",
        url: "https://example.com/fresh",
        publishedAt: new Date("2026-07-21T09:05:00.000Z"),
      },
    ],
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SOURCE, "manual");

  assert.equal(result.ok, true);
  assert.equal(result.newItems, 1);
  assert.equal(result.newOriginals, 1);
  assert.equal(db.state.items.length, 1);
  assert.equal(db.state.items[0]?.externalId, "fresh-entry");
  assert.equal(db.state.originals.length, 1);
  assert.equal(db.state.originals[0]?.externalId, "fresh-entry");
  assert.equal(db.log.includes("event:item-1"), true);
});

const SLACK_SOURCE: SyncableSource = {
  ...SOURCE,
  kind: "slack_channel",
  config: { channelId: "channel-a", teamId: "T1", mode: "poll" },
  cursor: null,
};

test("Slack sync downloads a shared file, uploads it, and stores a file item", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SLACK_SOURCE.id, cursor: null, lastStatus: null, lastError: null }],
  });
  const putKeys: string[] = [];
  const downloaded: string[] = [];

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchSlackMessages: async () => ({
      latestTs: "1721552400.000100",
      messages: [],
      files: [
        {
          externalId: "F1",
          name: "report.pdf",
          mimeType: "application/pdf",
          urlPrivate: "https://files.slack.com/F1/report.pdf",
          size: 1024,
          postedAt: new Date("2026-07-21T09:00:00.000Z"),
        },
        // Unsupported type and oversized file are both skipped without upload.
        {
          externalId: "F2",
          name: "clip.mp4",
          mimeType: "video/mp4",
          urlPrivate: "https://files.slack.com/F2/clip.mp4",
          size: 2048,
          postedAt: new Date("2026-07-21T09:00:00.000Z"),
        },
        {
          externalId: "F3",
          name: "huge.pdf",
          mimeType: "application/pdf",
          urlPrivate: "https://files.slack.com/F3/huge.pdf",
          size: 999_999_999,
          postedAt: new Date("2026-07-21T09:00:00.000Z"),
        },
      ],
    }),
    downloadSlackFile: async (url: string) => {
      downloaded.push(url);
      return Buffer.from("pdf-bytes");
    },
    put: async (key: string) => {
      putKeys.push(key);
      return { url: `https://store.private.blob.vercel-storage.com/${key}` };
    },
    sendItemCaptured: async (itemId: string) => {
      db.log.push(`event:${itemId}`);
    },
  });

  const result = await runSourceSync(SLACK_SOURCE, "manual");

  assert.equal(result.ok, true);
  // Only the supported, in-size file was downloaded and uploaded.
  assert.deepEqual(downloaded, ["https://files.slack.com/F1/report.pdf"]);
  assert.equal(putKeys.length, 1);
  assert.match(putKeys[0]!, /^pdf\/user-a\/F1-report\.pdf$/);

  assert.equal(db.state.items.length, 1);
  const item = db.state.items[0]!;
  assert.equal(item.type, "pdf");
  assert.equal(item.externalId, "F1");
  assert.equal(item.source, "report.pdf");
  assert.equal(
    item.blobUrl,
    "https://store.private.blob.vercel-storage.com/pdf/user-a/F1-report.pdf"
  );

  const original = db.state.originals.find((o) => o.externalId === "F1")!;
  const payload = original.payload as Record<string, unknown>;
  assert.equal(payload.kind, "slack_file");
  assert.equal(payload.name, "report.pdf");
  assert.equal(payload.channelId, "channel-a");
  assert.equal(payload.teamId, "T1");
});

test("Slack sync skips a file whose id was already imported (no re-upload)", async () => {
  const db = new MockSyncDb({
    sources: [{ id: SLACK_SOURCE.id, cursor: null, lastStatus: null, lastError: null }],
    items: [
      {
        id: "item-existing",
        sourceId: SLACK_SOURCE.id,
        externalId: "F1",
        type: "pdf",
        status: "ready",
      },
    ],
  });
  let downloads = 0;
  let puts = 0;

  Object.assign(sourceSyncDeps as unknown as MutableDeps, {
    db,
    fetchSlackMessages: async () => ({
      latestTs: "1721552400.000100",
      messages: [],
      files: [
        {
          externalId: "F1",
          name: "report.pdf",
          mimeType: "application/pdf",
          urlPrivate: "https://files.slack.com/F1/report.pdf",
          size: 1024,
          postedAt: new Date("2026-07-21T09:00:00.000Z"),
        },
      ],
    }),
    downloadSlackFile: async () => {
      downloads += 1;
      return Buffer.from("x");
    },
    put: async () => {
      puts += 1;
      return { url: "https://store.private.blob.vercel-storage.com/x" };
    },
    sendItemCaptured: async () => {},
  });

  const result = await runSourceSync(SLACK_SOURCE, "manual");

  assert.equal(result.ok, true);
  assert.equal(downloads, 0, "an already-imported file must not be re-downloaded");
  assert.equal(puts, 0, "an already-imported file must not be re-uploaded");
  // No new item beyond the pre-seeded one.
  assert.equal(db.state.items.length, 1);
});
