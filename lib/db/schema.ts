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
} from "drizzle-orm/pg-core";

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
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
  (t) => [index("item_user_idx").on(t.userId, t.capturedAt)]
);

export const chunk = pgTable(
  "chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (t) => [
    index("chunk_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunk_user_idx").on(t.userId),
  ]
);

export const conversation = pgTable("conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
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
  name: text("name").notNull(),
  summary: text("summary"),
  itemIds: uuid("item_ids").array(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
export type Chunk = typeof chunk.$inferSelect;
export type Topic = typeof topic.$inferSelect;
export type Pipeline = typeof pipeline.$inferSelect;
