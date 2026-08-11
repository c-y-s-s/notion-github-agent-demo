import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
