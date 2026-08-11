import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AcceptanceStatus, EngineeringStatus } from "../lib/work-item-state";

export const workItems = sqliteTable("work_items", {
  id:text("id").primaryKey(),
  notionTaskId:text("notion_task_id").notNull(),
  notionUrl:text("notion_url").notNull(),
  title:text("title").notNull(),
  repository:text("repository").notNull(),
  githubIssueNumber:integer("github_issue_number").notNull(),
  githubIssueUrl:text("github_issue_url").notNull(),
  engineeringStatus:text("engineering_status").$type<EngineeringStatus>().notNull().default("issue_open"),
  acceptanceStatus:text("acceptance_status").$type<AcceptanceStatus>().notNull().default("not_started"),
  branch:text("branch"),
  pullRequestUrl:text("pull_request_url"),
  latestAgentRunId:text("latest_agent_run_id"),
  createdAt:text("created_at").notNull(),
  updatedAt:text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_work_items_notion_task_id").on(table.notionTaskId),
  uniqueIndex("idx_work_items_repository_issue").on(table.repository, table.githubIssueNumber),
  index("idx_work_items_engineering_status").on(table.engineeringStatus),
]);

export const agentRuns = sqliteTable("agent_runs", {
  id:text("id").primaryKey(),
  taskId:text("task_id").notNull(),
  taskTitle:text("task_title").notNull(),
  issueNumber:integer("issue_number"),
  status:text("status", { enum:["prepared", "prepare_failed", "push_failed", "pr_created"] }).notNull(),
  branch:text("branch"),
  changedFiles:integer("changed_files").notNull().default(0),
  changedLines:integer("changed_lines").notNull().default(0),
  testsPassed:integer("tests_passed", { mode:"boolean" }).notNull().default(false),
  humanDecision:text("human_decision", { enum:["pending", "accepted", "rejected"] }).notNull().default("pending"),
  pullRequestUrl:text("pull_request_url"),
  errorCode:text("error_code"),
  durationMs:integer("duration_ms").notNull().default(0),
  createdAt:text("created_at").notNull(),
  updatedAt:text("updated_at").notNull(),
}, (table) => [
  index("idx_agent_runs_created_at").on(table.createdAt),
  index("idx_agent_runs_status_created_at").on(table.status, table.createdAt),
]);
