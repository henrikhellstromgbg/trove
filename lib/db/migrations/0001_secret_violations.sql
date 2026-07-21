CREATE TABLE "ingest_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"project_id" uuid,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'personal' NOT NULL,
	"color" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cron" text,
	"next_run_at" timestamp with time zone,
	"cursor" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunk" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "chunk" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "pipeline" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pipeline" ADD COLUMN "last_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_token" ADD CONSTRAINT "ingest_token_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_token_user_idx" ON "ingest_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_token_hash_idx" ON "ingest_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "project_user_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_user_slug_idx" ON "project" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "source_user_idx" ON "source" USING btree ("user_id","project_id");--> statement-breakpoint
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunk_project_idx" ON "chunk" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "item_project_idx" ON "item" USING btree ("user_id","project_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_source_external_idx" ON "item" USING btree ("source_id","external_id");
