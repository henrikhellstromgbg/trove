WITH ranked_running AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "source_id"
			ORDER BY "started_at" DESC, "id" DESC
		) AS "position"
	FROM "source_run"
	WHERE "status" = 'running'
)
UPDATE "source_run"
SET
	"status" = 'error',
	"error" = COALESCE("error", 'closed while installing active-run constraint'),
	"completed_at" = COALESCE("completed_at", now())
FROM ranked_running
WHERE "source_run"."id" = ranked_running."id"
	AND ranked_running."position" > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "source_run_active_source_idx" ON "source_run" USING btree ("source_id") WHERE "source_run"."status" = 'running';
