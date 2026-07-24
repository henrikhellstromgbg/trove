import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  blob,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// SQLite mapping notes (see docs, CLAUDE.md "Conventions"):
//   uuid            -> text PK, app-generated via crypto.randomUUID()
//   jsonb           -> text({ mode: "json" })
//   timestamptz     -> integer({ mode: "timestamp_ms" }) — unix epoch ms, one
//                      representation everywhere; Drizzle maps it to/from Date
//   text[]          -> text({ mode: "json" }) holding a JSON array
//   boolean         -> integer({ mode: "boolean" })
//   vector(768)     -> blob (Float32 buffer); similarity is computed in JS,
//                      see lib/db/vector.ts. No ANN index at personal scale.
// Foreign-key actions are declared here but only enforced because the client
// sets `PRAGMA foreign_keys = ON` (lib/db/index.ts).

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

// Hard container. Everything below scopes to a project.
// See docs/architecture-v2.md.
export const project = sqliteTable(
  "project",
  {
    id: id(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull().default("personal"), // personal | client
    color: text("color"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("project_user_idx").on(t.userId),
    uniqueIndex("project_user_slug_idx").on(t.userId, t.slug),
  ]
);

export const connectedAccount = sqliteTable(
  "connected_account",
  {
    id: id(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(), // gmail | slack | local
    accountKey: text("account_key").notNull(),
    label: text("label"),
    config: text("config", { mode: "json" }).notNull().$defaultFn(() => ({})),
    status: text("status").notNull().default("active"), // active | error | revoked
    lastHealthyAt: integer("last_healthy_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("connected_account_user_idx").on(t.userId),
    uniqueIndex("connected_account_provider_key_idx").on(
      t.userId,
      t.provider,
      t.accountKey
    ),
  ]
);

export const source = sqliteTable(
  "source",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id").references(
      () => connectedAccount.id,
      { onDelete: "set null" }
    ),
    kind: text("kind").notNull(), // mail_folder | folder_watch | youtube_channel | rss | web_scrape | slack_channel
    name: text("name").notNull(),
    config: text("config", { mode: "json" }).notNull().$defaultFn(() => ({})),
    runtime: text("runtime").notNull(), // cloud | local
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    cron: text("cron"),
    nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }),
    cursor: text("cursor", { mode: "json" }),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
    lastStatus: text("last_status"), // ok | error | running
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("source_user_idx").on(t.userId, t.projectId),
    index("source_connected_account_idx").on(t.connectedAccountId),
  ]
);

export const sourceRule = sqliteTable(
  "source_rule",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    ruleType: text("rule_type").notNull().default("selection"), // selection | review
    config: text("config", { mode: "json" }).notNull().$defaultFn(() => ({})),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), // active version for its ruleType
    createdAt: createdAt(),
  },
  (t) => [
    index("source_rule_project_idx").on(t.userId, t.projectId, t.sourceId),
    uniqueIndex("source_rule_source_version_idx").on(t.sourceId, t.version),
  ]
);

export const sourceRun = sqliteTable(
  "source_run",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(), // manual | cron | webhook | local
    status: text("status").notNull(), // running | ok | error
    cursorBefore: text("cursor_before", { mode: "json" }),
    cursorAfter: text("cursor_after", { mode: "json" }),
    itemCount: integer("item_count").notNull().default(0),
    originalCount: integer("original_count").notNull().default(0),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("source_run_project_idx").on(t.userId, t.projectId, t.startedAt),
    index("source_run_source_idx").on(t.sourceId, t.startedAt),
    uniqueIndex("source_run_active_source_idx")
      .on(t.sourceId)
      .where(sql`${t.status} = 'running'`),
  ]
);

export const ingestToken = sqliteTable(
  "ingest_token",
  {
    id: id(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    // Project-bound tokens must disappear with project, never become unlocked.
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    label: text("label"),
    createdAt: createdAt(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("ingest_token_user_idx").on(t.userId),
    uniqueIndex("ingest_token_hash_idx").on(t.tokenHash),
  ]
);

export const item = sqliteTable(
  "item",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => source.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"),
    type: text("type").notNull(),
    source: text("source"),
    blobUrl: text("blob_url"),
    rawText: text("raw_text"),
    title: text("title"),
    summary: text("summary"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    status: text("status").notNull().default("pending"), // pending | processing | ready | failed | review | trashed | deleting
    trashedAt: integer("trashed_at", { mode: "timestamp_ms" }),
    restoreStatus: text("restore_status"),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("item_user_idx").on(t.userId, t.capturedAt),
    index("item_project_idx").on(t.userId, t.projectId, t.capturedAt),
    uniqueIndex("item_source_external_idx").on(t.sourceId, t.externalId),
  ]
);

export const reviewDecision = sqliteTable(
  "review_decision",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(), // approve | reject
    note: text("note"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("review_decision_project_idx").on(t.userId, t.projectId, t.decidedAt),
    index("review_decision_item_idx").on(t.itemId, t.decidedAt),
  ]
);

export const deletionMarker = sqliteTable(
  "deletion_marker",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("deletion_marker_project_source_external_idx").on(
      t.projectId,
      t.sourceId,
      t.externalId
    ),
    index("deletion_marker_project_idx").on(t.userId, t.projectId, t.createdAt),
  ]
);

export const originalRecord = sqliteTable(
  "original_record",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    sourceRunId: text("source_run_id").references(() => sourceRun.id, {
      onDelete: "set null",
    }),
    itemId: text("item_id").references(() => item.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id").notNull(),
    version: integer("version").notNull().default(1),
    contentType: text("content_type"),
    sourceLabel: text("source_label"),
    payload: text("payload", { mode: "json" }).notNull().$defaultFn(() => ({})),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
  },
  (t) => [
    index("original_record_project_idx").on(t.userId, t.projectId, t.capturedAt),
    index("original_record_source_idx").on(t.sourceId, t.capturedAt),
    index("original_record_source_run_idx").on(t.sourceRunId),
    uniqueIndex("original_record_source_external_version_idx").on(
      t.sourceId,
      t.externalId,
      t.version
    ),
  ]
);

export const chunk = sqliteTable(
  "chunk",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    // Float32Array of 768 dims, stored as a raw little-endian buffer.
    // Encode/decode via lib/db/vector.ts. Nullable until embedding completes.
    embedding: blob("embedding", { mode: "buffer" }),
  },
  (t) => [
    index("chunk_user_idx").on(t.userId),
    index("chunk_project_idx").on(t.userId, t.projectId),
    index("chunk_item_idx").on(t.itemId),
  ]
);

export const conversation = sqliteTable("conversation", {
  id: id(),
  userId: text("user_id").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: createdAt(),
});

export const message = sqliteTable("message", {
  id: id(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: text("citations", { mode: "json" }),
  createdAt: createdAt(),
});

export const pipeline = sqliteTable(
  "pipeline",
  {
    id: id(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    templateKey: text("template_key"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    spec: text("spec", { mode: "json" }).notNull(),
    cron: text("cron"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }),
    lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pipeline_project_template_idx").on(t.projectId, t.templateKey)]
);

export const pipelineRun = sqliteTable("pipeline_run", {
  id: id(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipeline.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  output: text("output", { mode: "json" }),
  startedAt: integer("started_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const topic = sqliteTable("topic", {
  id: id(),
  userId: text("user_id").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  summary: text("summary"),
  itemIds: text("item_ids", { mode: "json" }).$type<string[]>(),
  generatedAt: integer("generated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type ConnectedAccount = typeof connectedAccount.$inferSelect;
export type NewConnectedAccount = typeof connectedAccount.$inferInsert;
export type Source = typeof source.$inferSelect;
export type NewSource = typeof source.$inferInsert;
export type SourceRule = typeof sourceRule.$inferSelect;
export type NewSourceRule = typeof sourceRule.$inferInsert;
export type SourceRun = typeof sourceRun.$inferSelect;
export type NewSourceRun = typeof sourceRun.$inferInsert;
export type IngestToken = typeof ingestToken.$inferSelect;
export type NewIngestToken = typeof ingestToken.$inferInsert;
export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
export type ReviewDecision = typeof reviewDecision.$inferSelect;
export type NewReviewDecision = typeof reviewDecision.$inferInsert;
export type DeletionMarker = typeof deletionMarker.$inferSelect;
export type NewDeletionMarker = typeof deletionMarker.$inferInsert;
export type OriginalRecord = typeof originalRecord.$inferSelect;
export type NewOriginalRecord = typeof originalRecord.$inferInsert;
export type Chunk = typeof chunk.$inferSelect;
export type NewChunk = typeof chunk.$inferInsert;
export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;
export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;
export type Pipeline = typeof pipeline.$inferSelect;
export type NewPipeline = typeof pipeline.$inferInsert;
export type PipelineRun = typeof pipelineRun.$inferSelect;
export type NewPipelineRun = typeof pipelineRun.$inferInsert;
export type Topic = typeof topic.$inferSelect;
export type NewTopic = typeof topic.$inferInsert;
