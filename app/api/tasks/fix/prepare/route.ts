import { consumeFixApproval } from "../../../../../lib/fix-approvals";
import { recordFailedRun, recordPreparedRun, tryRecord } from "../../../../../lib/agent-runs";
import { transitionWorkItemByTask, tryWorkItem } from "../../../../../lib/work-items";

function isLocal(request:Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function POST(request:Request) {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  let context:{taskId:string;taskTitle:string;issueNumber:number|null}|null = null;
  try {
    if (!isLocal(request)) return Response.json({ error:"local_only" }, { status:403 });
    const { taskId, approvalToken } = await request.json() as { taskId?:string; approvalToken?:string };
    if (!taskId || !approvalToken) return Response.json({ error:"invalid_request" }, { status:400 });
    const approval = consumeFixApproval(approvalToken, taskId);
    if (!approval) return Response.json({ error:"approval_expired_or_invalid" }, { status:403 });
    context = { taskId, taskTitle:approval.title, issueNumber:approval.issueNumber };
    await tryWorkItem(() => transitionWorkItemByTask(taskId, { engineeringStatus:"fixing", latestAgentRunId:runId }));
    const runner = await fetch("http://127.0.0.1:4319/prepare", { method:"POST", headers:{ "Content-Type":"application/json", "X-Traceboard-Runner":"1" }, body:JSON.stringify({ runId, taskId, ...approval }), signal:AbortSignal.timeout(10 * 60_000) });
    const data = await runner.json() as { error?:string;branch?:string;changedFiles?:string[];changedLines?:number;durationMs?:number };
    if (!runner.ok) throw new Error(data.error || "Local runner failed");
    await tryRecord(() => recordPreparedRun({ id:runId, taskId, taskTitle:approval.title, issueNumber:approval.issueNumber, branch:data.branch || "", changedFiles:data.changedFiles?.length || 0, changedLines:data.changedLines || 0, durationMs:data.durationMs || Date.now() - startedAt }));
    await tryWorkItem(() => transitionWorkItemByTask(taskId, { engineeringStatus:"awaiting_push_approval", branch:data.branch || null, latestAgentRunId:runId }));
    return Response.json(data);
  } catch (error) {
    if (context) await tryRecord(() => recordFailedRun({ id:runId, taskId:context.taskId, taskTitle:context.taskTitle, issueNumber:context.issueNumber, stage:"prepare", error, durationMs:Date.now() - startedAt }));
    if (context) await tryWorkItem(() => transitionWorkItemByTask(context!.taskId, { engineeringStatus:/lint|test|build|Command failed/i.test(error instanceof Error ? error.message : "") ? "tests_failed" : "blocked", latestAgentRunId:runId }));
    return Response.json({ error:error instanceof Error ? error.message : "Fix preparation failed" }, { status:502 });
  }
}
