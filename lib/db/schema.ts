import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Hard container. Everything below scopes to a project.
// See docs/architecture-v2.md.
export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull().default("personal"), // personal | client
    color: text("color"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_user_idx").on(t.userId),
    uniqueIndex("project_user_slug_idx").on(t.userId, t.slug),
  ]
);

export const connectedAccount = pgTable(
  "connected_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(), // gmail | slack | local
    accountKey: text("account_key").notNull(),
    label: text("label"),
    config: jsonb("config").notNull().default({}),
    status: text("status").notNull().default("active"), // active | error | revoked
    lastHealthyAt: timestamp("last_healthy_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const source = pgTable(
  "source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id").references(
      () => connectedAccount.id,
      { onDelete: "set null" }
    ),
    kind: text("kind").notNull(), // mail_folder | folder_watch | youtube_channel | rss | web_scrape | slack_channel
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}),
    runtime: text("runtime").notNull(), // cloud | local
    enabled: boolean("enabled").notNull().default(true),
    cron: text("cron"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    cursor: jsonb("cursor"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastStatus: text("last_status"), // ok | error | running
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_user_idx").on(t.userId, t.projectId),
    index("source_connected_account_idx").on(t.connectedAccountId),
  ]
);

export const sourceRule = pgTable(
  "source_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    ruleType: text("rule_type").notNull().default("selection"), // selection | review
    config: jsonb("config").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true), // active version for its ruleType
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_rule_project_idx").on(t.userId, t.projectId, t.sourceId),
    uniqueIndex("source_rule_source_version_idx").on(t.sourceId, t.version),
  ]
);

export const sourceRun = pgTable(
  "source_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(), // manual | cron | webhook | local
    status: text("status").notNull(), // running | ok | error
    cursorBefore: jsonb("cursor_before"),
    cursorAfter: jsonb("cursor_after"),
    itemCount: integer("item_count").notNull().default(0),
    originalCount: integer("original_count").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("source_run_project_idx").on(t.userId, t.projectId, t.startedAt),
    index("source_run_source_idx").on(t.sourceId, t.startedAt),
    uniqueIndex("source_run_active_source_idx")
      .on(t.sourceId)
      .where(sql`${t.status} = 'running'`),
  ]
);

export const ingestToken = pgTable(
  "ingest_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    // Project-bound tokens must disappear with project, never become unlocked.
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("ingest_token_user_idx").on(t.userId),
    uniqueIndex("ingest_token_hash_idx").on(t.tokenHash),
  ]
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => source.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"),
    type: text("type").notNull(),
    source: text("source"),
    blobUrl: text("blob_url"),
    rawText: text("raw_text"),
    title: text("title"),
    summary: text("summary"),
    tags: text("tags").array(),
    status: text("status").notNull().default("pending"), // pending | processing | ready | failed | review | trashed | deleting
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    restoreStatus: text("restore_status"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("item_user_idx").on(t.userId, t.capturedAt),
    index("item_project_idx").on(t.userId, t.projectId, t.capturedAt),
    uniqueIndex("item_source_external_idx").on(t.sourceId, t.externalId),
  ]
);

export const reviewDecision = pgTable(
  "review_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(), // approve | reject
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("review_decision_project_idx").on(t.userId, t.projectId, t.decidedAt),
    index("review_decision_item_idx").on(t.itemId, t.decidedAt),
  ]
);

export const deletionMarker = pgTable(
  "deletion_marker",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const originalRecord = pgTable(
  "original_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    sourceRunId: uuid("source_run_id").references(() => sourceRun.id, {
      onDelete: "set null",
    }),
    itemId: uuid("item_id").references(() => item.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id").notNull(),
    version: integer("version").notNull().default(1),
    contentType: text("content_type"),
    sourceLabel: text("source_label"),
    payload: jsonb("payload").notNull().default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const chunk = pgTable(
  "chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (t) => [
    index("chunk_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunk_user_idx").on(t.userId),
    index("chunk_project_idx").on(t.userId, t.projectId),
  ]
);

export const conversation = pgTable("conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const message = pgTable("message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pipeline = pgTable(
  "pipeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    templateKey: text("template_key"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    spec: jsonb("spec").notNull(),
    cron: text("cron"),
    enabled: boolean("enabled").notNull().default(true),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pipeline_project_template_idx").on(t.projectId, t.templateKey)]
);

export const pipelineRun = pgTable("pipeline_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id")
    .notNull()
    .references(() => pipeline.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  output: jsonb("output"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const topic = pgTable("topic", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  summary: text("summary"),
  itemIds: uuid("item_ids").array(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
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
