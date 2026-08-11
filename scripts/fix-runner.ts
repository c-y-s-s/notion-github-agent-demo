import { createServer } from "node:http";
import { prepareLocalFix, pushLocalFix } from "../lib/local-fix-runner";

type StoredRun = { taskId:string; title:string; issueNumber:number|null; branch:string; worktree:string; changedFiles:string[]; expiresAt:number };
const runs = new Map<string, StoredRun>();

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
      const prepared = await prepareLocalFix({
        title:String(input.title || ""),
        issueNumber:typeof input.issueNumber === "number" ? input.issueNumber : null,
        allowedFiles:Array.isArray(input.allowedFiles) ? input.allowedFiles.map(String) : [],
        summary:String(input.summary || ""),
        proposedChanges:Array.isArray(input.proposedChanges) ? input.proposedChanges.map(String) : [],
        validationSteps:Array.isArray(input.validationSteps) ? input.validationSteps.map(String) : [],
      });
      const pushToken = crypto.randomUUID();
      runs.set(pushToken, { taskId:String(input.taskId), title:String(input.title), issueNumber:typeof input.issueNumber === "number" ? input.issueNumber : null, branch:prepared.branch, worktree:prepared.worktree, changedFiles:prepared.changedFiles, expiresAt:Date.now() + 30 * 60_000 });
      return json(response, 200, { branch:prepared.branch, changedFiles:prepared.changedFiles, diff:prepared.diff, testSummary:prepared.testSummary, pushToken });
    }
    if (request.url === "/push") {
      const pushToken = String(input.pushToken || "");
      const run = runs.get(pushToken);
      runs.delete(pushToken);
      if (!run || run.taskId !== String(input.taskId) || run.expiresAt < Date.now()) return json(response, 403, { error:"push_approval_expired_or_invalid" });
      return json(response, 200, await pushLocalFix(run));
    }
    return json(response, 404, { error:"not_found" });
  } catch (error) { return json(response, 502, { error:error instanceof Error ? error.message : "runner_failed" }); }
}).listen(4319, "127.0.0.1", () => process.stdout.write("Traceboard fix runner listening on http://127.0.0.1:4319\n"));
