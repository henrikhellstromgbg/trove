CREATE TABLE "deletion_marker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "restore_status" text;--> statement-breakpoint
ALTER TABLE "deletion_marker" ADD CONSTRAINT "deletion_marker_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_marker" ADD CONSTRAINT "deletion_marker_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_marker_project_source_external_idx" ON "deletion_marker" USING btree ("project_id","source_id","external_id");--> statement-breakpoint
CREATE INDEX "deletion_marker_project_idx" ON "deletion_marker" USING btree ("user_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "review_decision_project_idx" ON "review_decision" USING btree ("user_id","project_id","decided_at");--> statement-breakpoint
CREATE INDEX "review_decision_item_idx" ON "review_decision" USING btree ("item_id","decided_at");