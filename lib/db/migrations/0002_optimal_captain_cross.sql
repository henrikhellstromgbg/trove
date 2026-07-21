CREATE TABLE "connected_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_key" text NOT NULL,
	"label" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_healthy_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "original_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_run_id" uuid,
	"item_id" uuid,
	"external_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_type" text,
	"source_label" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"rule_type" text DEFAULT 'selection' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"cursor_before" jsonb,
	"cursor_after" jsonb,
	"item_count" integer DEFAULT 0 NOT NULL,
	"original_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "connected_account_id" uuid;--> statement-breakpoint
ALTER TABLE "original_record" ADD CONSTRAINT "original_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "original_record" ADD CONSTRAINT "original_record_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "original_record" ADD CONSTRAINT "original_record_source_run_id_source_run_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "original_record" ADD CONSTRAINT "original_record_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rule" ADD CONSTRAINT "source_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rule" ADD CONSTRAINT "source_rule_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_run" ADD CONSTRAINT "source_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_run" ADD CONSTRAINT "source_run_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connected_account_user_idx" ON "connected_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_provider_key_idx" ON "connected_account" USING btree ("user_id","provider","account_key");--> statement-breakpoint
CREATE INDEX "original_record_project_idx" ON "original_record" USING btree ("user_id","project_id","captured_at");--> statement-breakpoint
CREATE INDEX "original_record_source_idx" ON "original_record" USING btree ("source_id","captured_at");--> statement-breakpoint
CREATE INDEX "original_record_source_run_idx" ON "original_record" USING btree ("source_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "original_record_source_external_version_idx" ON "original_record" USING btree ("source_id","external_id","version");--> statement-breakpoint
CREATE INDEX "source_rule_project_idx" ON "source_rule" USING btree ("user_id","project_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_rule_source_version_idx" ON "source_rule" USING btree ("source_id","version");--> statement-breakpoint
CREATE INDEX "source_run_project_idx" ON "source_run" USING btree ("user_id","project_id","started_at");--> statement-breakpoint
CREATE INDEX "source_run_source_idx" ON "source_run" USING btree ("source_id","started_at");--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_connected_account_id_connected_account_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_connected_account_idx" ON "source" USING btree ("connected_account_id");