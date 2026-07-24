ALTER TABLE "deletion_marker" DROP CONSTRAINT "deletion_marker_source_id_source_id_fk";
--> statement-breakpoint
ALTER TABLE "deletion_marker" ADD CONSTRAINT "deletion_marker_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE restrict ON UPDATE no action;