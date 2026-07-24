CREATE TABLE `chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`embedding` blob,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunk_user_idx` ON `chunk` (`user_id`);--> statement-breakpoint
CREATE INDEX `chunk_project_idx` ON `chunk` (`user_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `chunk_item_idx` ON `chunk` (`item_id`);--> statement-breakpoint
CREATE TABLE `connected_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`account_key` text NOT NULL,
	`label` text,
	`config` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_healthy_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `connected_account_user_idx` ON `connected_account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connected_account_provider_key_idx` ON `connected_account` (`user_id`,`provider`,`account_key`);--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deletion_marker` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deletion_marker_project_source_external_idx` ON `deletion_marker` (`project_id`,`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `deletion_marker_project_idx` ON `deletion_marker` (`user_id`,`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ingest_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`project_id` text,
	`label` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingest_token_user_idx` ON `ingest_token` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_hash_idx` ON `ingest_token` (`token_hash`);--> statement-breakpoint
CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text,
	`external_id` text,
	`type` text NOT NULL,
	`source` text,
	`blob_url` text,
	`raw_text` text,
	`title` text,
	`summary` text,
	`tags` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`trashed_at` integer,
	`restore_status` text,
	`captured_at` integer NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `item_user_idx` ON `item` (`user_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `item_project_idx` ON `item` (`user_id`,`project_id`,`captured_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_source_external_idx` ON `item` (`source_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `original_record` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_run_id` text,
	`item_id` text,
	`external_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_type` text,
	`source_label` text,
	`payload` text NOT NULL,
	`captured_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_run_id`) REFERENCES `source_run`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `original_record_project_idx` ON `original_record` (`user_id`,`project_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `original_record_source_idx` ON `original_record` (`source_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `original_record_source_run_idx` ON `original_record` (`source_run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `original_record_source_external_version_idx` ON `original_record` (`source_id`,`external_id`,`version`);--> statement-breakpoint
CREATE TABLE `pipeline` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`template_key` text,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`spec` text NOT NULL,
	`cron` text,
	`enabled` integer DEFAULT true NOT NULL,
	`next_run_at` integer,
	`last_run_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pipeline_project_template_idx` ON `pipeline` (`project_id`,`template_key`);--> statement-breakpoint
CREATE TABLE `pipeline_run` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`output` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'personal' NOT NULL,
	`color` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_user_idx` ON `project` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_user_slug_idx` ON `project` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `review_decision` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`item_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_decision_project_idx` ON `review_decision` (`user_id`,`project_id`,`decided_at`);--> statement-breakpoint
CREATE INDEX `review_decision_item_idx` ON `review_decision` (`item_id`,`decided_at`);--> statement-breakpoint
CREATE TABLE `source` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`connected_account_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`runtime` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`cron` text,
	`next_run_at` integer,
	`cursor` text,
	`last_sync_at` integer,
	`last_status` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `source_user_idx` ON `source` (`user_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `source_connected_account_idx` ON `source` (`connected_account_id`);--> statement-breakpoint
CREATE TABLE `source_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text NOT NULL,
	`version` integer NOT NULL,
	`rule_type` text DEFAULT 'selection' NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_rule_project_idx` ON `source_rule` (`user_id`,`project_id`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_rule_source_version_idx` ON `source_rule` (`source_id`,`version`);--> statement-breakpoint
CREATE TABLE `source_run` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`cursor_before` text,
	`cursor_after` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`original_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_run_project_idx` ON `source_run` (`user_id`,`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `source_run_source_idx` ON `source_run` (`source_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_run_active_source_idx` ON `source_run` (`source_id`) WHERE "source_run"."status" = 'running';--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`item_ids` text,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
