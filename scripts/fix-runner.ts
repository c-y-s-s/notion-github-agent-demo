import { createServer } from "node:http";
import { cleanupLocalFix, prepareLocalFix, pushLocalFix } from "../lib/local-fix-runner";

type StoredRun = { runId:string; taskId:string; title:string; issueNumber:number|null; branch:string; worktree:string; changedFiles:string[]; expiresAt:number; status:"ready"|"pushing" };
const runs = new Map<string, StoredRun>();
const preparingTasks = new Set<string>();

async function cleanupExpiredRuns() {
  const expired = [...runs.entries()].filter(([, run]) => run.expiresAt < Date.now() && run.status !== "pushing");
  for (const [token, run] of expired) {
    runs.delete(token);
    await cleanupLocalFix(run);
  }
}

setInterval(() => { void cleanupExpiredRuns(); }, 60_000).unref();

async function body(request:import("node:http").IncomingMessage) {
  const chunks:Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function json(response:import("node:http").ServerResponse, status:number, value:unknown) {
  response.writeHead(status, { "Content-Type":"application/json", "Access-Control-Allow-Origin":"null" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  try {
    if (request.headers["x-traceboard-runner"] !== "1") return json(response, 403, { error:"runner_forbidden" });
    if (request.method !== "POST") return json(response, 405, { error:"method_not_allowed" });
    const input = await body(request);
    if (request.url === "/prepare") {
      const taskId = String(input.taskId || "");
      const runId = String(input.runId || "");
      if (!runId || !taskId || preparingTasks.has(taskId) || [...runs.values()].some((run) => run.taskId === taskId)) return json(response, 409, { error:"fix_already_in_progress", runId });
      preparingTasks.add(taskId);
      try {
        const prepared = await prepareLocalFix({
          title:String(input.title || ""),
          issueNumber:typeof input.issueNumber === "number" ? input.issueNumber : null,
          allowedFiles:Array.isArray(input.allowedFiles) ? input.allowedFiles.map(String) : [],
          summary:String(input.summary || ""),
          proposedChanges:Array.isArray(input.proposedChanges) ? input.proposedChanges.map(String) : [],
          validationSteps:Array.isArray(input.validationSteps) ? input.validationSteps.map(String) : [],
        });
        const pushToken = crypto.randomUUID();
        runs.set(pushToken, { runId, taskId, title:String(input.title), issueNumber:typeof input.issueNumber === "number" ? input.issueNumber : null, branch:prepared.branch, worktree:prepared.worktree, changedFiles:prepared.changedFiles, expiresAt:Date.now() + 30 * 60_000, status:"ready" });
        return json(response, 200, { runId, branch:prepared.branch, changedFiles:prepared.changedFiles, changedLines:prepared.changedLines, durationMs:prepared.durationMs, diff:prepared.diff, testSummary:prepared.testSummary, pushToken });
      } finally { preparingTasks.delete(taskId); }
    }
    if (request.url === "/push") {
      const pushToken = String(input.pushToken || "");
      const run = runs.get(pushToken);
      if (!run || run.taskId !== String(input.taskId) || run.expiresAt < Date.now()) return json(response, 403, { error:"push_approval_expired_or_invalid" });
      if (run.status === "pushing") return json(response, 409, { error:"push_already_in_progress" });
      run.status = "pushing";
      try {
        const result = await pushLocalFix(run);
        runs.delete(pushToken);
        return json(response, 200, { ...result, runId:run.runId });
      } catch (error) {
        run.status = "ready";
        return json(response, 502, { runId:run.runId, taskTitle:run.title, issueNumber:run.issueNumber, error:error instanceof Error ? error.message : "push_failed" });
      }
    }
    return json(response, 404, { error:"not_found" });
  } catch (error) { return json(response, 502, { error:error instanceof Error ? error.message : "runner_failed" }); }
}).listen(4319, "127.0.0.1", () => process.stdout.write("Traceboard fix runner listening on http://127.0.0.1:4319\n"));
