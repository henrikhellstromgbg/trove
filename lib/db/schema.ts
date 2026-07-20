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

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    // Nullable during the Phase 1 backfill, made not-null once populated.
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
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
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
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
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
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
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
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
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  summary: text("summary"),
  itemIds: uuid("item_ids").array(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Retired by Phase 1 once projects land. Kept until the backfill migrates
// any existing groupings into projects. See docs/architecture-v2.md.
export const space = pgTable(
  "space",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    tags: text("tags").array(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("space_user_idx").on(t.userId)]
);

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
export type Chunk = typeof chunk.$inferSelect;
export type Topic = typeof topic.$inferSelect;
export type Pipeline = typeof pipeline.$inferSelect;
export type Space = typeof space.$inferSelect;
