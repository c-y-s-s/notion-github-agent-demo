CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_task_id` text NOT NULL,
	`notion_url` text NOT NULL,
	`title` text NOT NULL,
	`repository` text NOT NULL,
	`github_issue_number` integer NOT NULL,
	`github_issue_url` text NOT NULL,
	`engineering_status` text DEFAULT 'issue_open' NOT NULL,
	`acceptance_status` text DEFAULT 'not_started' NOT NULL,
	`branch` text,
	`pull_request_url` text,
	`latest_agent_run_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_items_notion_task_id` ON `work_items` (`notion_task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_items_repository_issue` ON `work_items` (`repository`,`github_issue_number`);--> statement-breakpoint
CREATE INDEX `idx_work_items_engineering_status` ON `work_items` (`engineering_status`);