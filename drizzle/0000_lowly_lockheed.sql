CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_title` text NOT NULL,
	`issue_number` integer,
	`status` text NOT NULL,
	`branch` text,
	`changed_files` integer DEFAULT 0 NOT NULL,
	`changed_lines` integer DEFAULT 0 NOT NULL,
	`tests_passed` integer DEFAULT false NOT NULL,
	`human_decision` text DEFAULT 'pending' NOT NULL,
	`pull_request_url` text,
	`error_code` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_created_at` ON `agent_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_runs_status_created_at` ON `agent_runs` (`status`,`created_at`);