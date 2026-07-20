import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

export const source = pgTable(
  "source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // drop | mail_folder | folder_watch | youtube_channel | rss | web_scrape | slack_channel
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}),
    runtime: text("runtime").notNull(), // cloud | local
    enabled: boolean("enabled").notNull().default(true),
    cron: text("cron"),
    cursor: jsonb("cursor"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastStatus: text("last_status"), // ok | error | running
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("source_user_idx").on(t.userId, t.projectId)]
);

export const ingestToken = pgTable(
  "ingest_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "set null",
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
    status: text("status").notNull().default("pending"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("item_user_idx").on(t.userId, t.capturedAt),
    index("item_project_idx").on(t.userId, t.projectId, t.capturedAt),
    uniqueIndex("item_source_external_idx").on(t.sourceId, t.externalId),
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

export const pipeline = pgTable("pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  spec: jsonb("spec").notNull(),
  cron: text("cron"),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
export type Source = typeof source.$inferSelect;
export type NewSource = typeof source.$inferInsert;
export type IngestToken = typeof ingestToken.$inferSelect;
export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
export type Chunk = typeof chunk.$inferSelect;
export type Topic = typeof topic.$inferSelect;
export type Pipeline = typeof pipeline.$inferSelect;
