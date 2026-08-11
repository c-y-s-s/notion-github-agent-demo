import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { agentRuns } from "../db/schema";
import { summarizeAgentRuns } from "./agent-evaluation";

let schemaReady:Promise<void>|null = null;

function ensureAgentRunsSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS agent_runs (
        id text PRIMARY KEY NOT NULL, task_id text NOT NULL, task_title text NOT NULL,
        issue_number integer, status text NOT NULL, branch text,
        changed_files integer DEFAULT 0 NOT NULL, changed_lines integer DEFAULT 0 NOT NULL,
        tests_passed integer DEFAULT false NOT NULL, human_decision text DEFAULT 'pending' NOT NULL,
        pull_request_url text, error_code text, duration_ms integer DEFAULT 0 NOT NULL,
        created_at text NOT NULL, updated_at text NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_agent_runs_status_created_at ON agent_runs(status, created_at)"),
    ]);
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

type PreparedRun = {
  id:string; taskId:string; taskTitle:string; issueNumber:number|null; branch:string;
  changedFiles:number; changedLines:number; durationMs:number;
};

function errorCode(error:unknown) {
  const value = error instanceof Error ? error.message : String(error || "unknown_error");
  return value.split("\n", 1)[0].replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 120) || "unknown_error";
}

export async function recordPreparedRun(run:PreparedRun) {
  await ensureAgentRunsSchema();
  const now = new Date().toISOString();
  await getDb().insert(agentRuns).values({
    id:run.id, taskId:run.taskId, taskTitle:run.taskTitle, issueNumber:run.issueNumber,
    status:"prepared", branch:run.branch, changedFiles:run.changedFiles, changedLines:run.changedLines,
    testsPassed:true, humanDecision:"pending", durationMs:run.durationMs, createdAt:now, updatedAt:now,
  }).onConflictDoUpdate({ target:agentRuns.id, set:{ status:"prepared", branch:run.branch, changedFiles:run.changedFiles, changedLines:run.changedLines, testsPassed:true, durationMs:run.durationMs, updatedAt:now } });
}

export async function recordFailedRun(input:{id:string;taskId:string;taskTitle:string;issueNumber:number|null;stage:"prepare"|"push";error:unknown;durationMs:number}) {
  await ensureAgentRunsSchema();
  const now = new Date().toISOString();
  await getDb().insert(agentRuns).values({
    id:input.id, taskId:input.taskId, taskTitle:input.taskTitle, issueNumber:input.issueNumber,
    status:input.stage === "prepare" ? "prepare_failed" : "push_failed", errorCode:errorCode(input.error),
    testsPassed:false, humanDecision:input.stage === "push" ? "accepted" : "pending", durationMs:input.durationMs, createdAt:now, updatedAt:now,
  }).onConflictDoUpdate({ target:agentRuns.id, set:{ status:input.stage === "prepare" ? "prepare_failed" : "push_failed", errorCode:errorCode(input.error), humanDecision:input.stage === "push" ? "accepted" : "pending", durationMs:input.durationMs, updatedAt:now } });
}

export async function recordCreatedPullRequest(input:{id:string;pullRequestUrl:string;durationMs:number}) {
  await ensureAgentRunsSchema();
  await getDb().update(agentRuns).set({ status:"pr_created", humanDecision:"accepted", pullRequestUrl:input.pullRequestUrl, durationMs:input.durationMs, errorCode:null, updatedAt:new Date().toISOString() }).where(eq(agentRuns.id, input.id));
}

export async function getAgentEvaluation() {
  await ensureAgentRunsSchema();
  const runs = await getDb().select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(100);
  return { metrics:summarizeAgentRuns(runs), runs };
}

export async function tryRecord(operation:()=>Promise<void>) {
  try { await operation(); return true; } catch { return false; }
}
