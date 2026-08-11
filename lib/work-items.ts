import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { workItems } from "../db/schema";
import { canTransitionAcceptance, canTransitionEngineering, deriveAcceptanceStatus, deriveEngineeringStatus, type AcceptanceStatus, type EngineeringStatus } from "./work-item-state";

let schemaReady:Promise<void>|null = null;

function ensureWorkItemsSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS work_items (
        id text PRIMARY KEY NOT NULL, notion_task_id text NOT NULL, notion_url text NOT NULL,
        title text NOT NULL, repository text NOT NULL, github_issue_number integer NOT NULL,
        github_issue_url text NOT NULL, engineering_status text DEFAULT 'issue_open' NOT NULL,
        acceptance_status text DEFAULT 'not_started' NOT NULL, branch text, pull_request_url text,
        latest_agent_run_id text, created_at text NOT NULL, updated_at text NOT NULL
      )`),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_notion_task_id ON work_items(notion_task_id)"),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_repository_issue ON work_items(repository, github_issue_number)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_work_items_engineering_status ON work_items(engineering_status)"),
    ]);
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

function parseIssueUrl(value:string) {
  const match = value.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)$/);
  return match ? { repository:match[1], issueNumber:Number(match[2]), issueUrl:value } : null;
}

export async function upsertWorkItem(input:{notionTaskId:string;notionUrl:string;title:string;githubLinks:string[];status?:string;githubEvidence?:Array<{phase:string;url?:string}>}) {
  const issue = input.githubLinks.map(parseIssueUrl).find(Boolean);
  if (!issue) return null;
  await ensureWorkItemsSchema();
  const now = new Date().toISOString();
  const reconciled = {
    engineeringStatus:deriveEngineeringStatus((input.githubEvidence || []).map((item) => item.phase)),
    acceptanceStatus:deriveAcceptanceStatus(input.status || "未開始"),
  };
  const pullRequestUrl = (input.githubEvidence || []).find((item) => item.url?.includes("/pull/"))?.url || input.githubLinks.find((link) => link.includes("/pull/")) || null;
  const existing = await getDb().select().from(workItems).where(eq(workItems.notionTaskId, input.notionTaskId)).limit(1);
  if (existing[0]) {
    await getDb().update(workItems).set({ notionUrl:input.notionUrl, title:input.title, repository:issue.repository, githubIssueNumber:issue.issueNumber, githubIssueUrl:issue.issueUrl, ...reconciled, ...(pullRequestUrl ? { pullRequestUrl } : {}), updatedAt:now }).where(eq(workItems.id, existing[0].id));
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(workItems).values({ id, notionTaskId:input.notionTaskId, notionUrl:input.notionUrl, title:input.title, repository:issue.repository, githubIssueNumber:issue.issueNumber, githubIssueUrl:issue.issueUrl, ...reconciled, pullRequestUrl, createdAt:now, updatedAt:now });
  return id;
}

export async function transitionWorkItemByTask(taskId:string, input:{engineeringStatus?:EngineeringStatus;acceptanceStatus?:AcceptanceStatus;branch?:string|null;pullRequestUrl?:string|null;latestAgentRunId?:string|null}) {
  await ensureWorkItemsSchema();
  const current = (await getDb().select().from(workItems).where(eq(workItems.notionTaskId, taskId)).limit(1))[0];
  if (!current) throw new Error("work_item_not_found");
  if (input.engineeringStatus && !canTransitionEngineering(current.engineeringStatus, input.engineeringStatus)) throw new Error(`invalid_engineering_transition:${current.engineeringStatus}->${input.engineeringStatus}`);
  if (input.acceptanceStatus && !canTransitionAcceptance(current.acceptanceStatus, input.acceptanceStatus)) throw new Error(`invalid_acceptance_transition:${current.acceptanceStatus}->${input.acceptanceStatus}`);
  await getDb().update(workItems).set({ ...input, updatedAt:new Date().toISOString() }).where(and(eq(workItems.id, current.id), eq(workItems.updatedAt, current.updatedAt)));
}

export async function backfillWorkItems(tasks:Array<{id:string;notionUrl:string;title:string;githubLinks:string[];status?:string;githubEvidence?:Array<{phase:string;url?:string}>}>) {
  const ids = [] as string[];
  for (const task of tasks) {
    const id = await upsertWorkItem({ notionTaskId:task.id, notionUrl:task.notionUrl, title:task.title, githubLinks:task.githubLinks, status:task.status, githubEvidence:task.githubEvidence });
    if (id) ids.push(id);
  }
  return ids;
}

export async function listWorkItems() {
  await ensureWorkItemsSchema();
  return getDb().select().from(workItems).orderBy(desc(workItems.updatedAt)).limit(100);
}

export async function tryWorkItem(operation:()=>Promise<unknown>) {
  try { await operation(); return true; } catch { return false; }
}
