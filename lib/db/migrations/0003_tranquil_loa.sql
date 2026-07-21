ALTER TABLE "pipeline" ADD COLUMN "template_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_project_template_idx" ON "pipeline" USING btree ("project_id","template_key");