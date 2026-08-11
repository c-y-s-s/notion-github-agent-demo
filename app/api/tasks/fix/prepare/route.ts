import { consumeFixApproval } from "../../../../../lib/fix-approvals";

function isLocal(request:Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function POST(request:Request) {
  try {
    if (!isLocal(request)) return Response.json({ error:"local_only" }, { status:403 });
    const { taskId, approvalToken } = await request.json() as { taskId?:string; approvalToken?:string };
    if (!taskId || !approvalToken) return Response.json({ error:"invalid_request" }, { status:400 });
    const approval = consumeFixApproval(approvalToken, taskId);
    if (!approval) return Response.json({ error:"approval_expired_or_invalid" }, { status:403 });
    const runner = await fetch("http://127.0.0.1:4319/prepare", { method:"POST", headers:{ "Content-Type":"application/json", "X-Traceboard-Runner":"1" }, body:JSON.stringify({ taskId, ...approval }), signal:AbortSignal.timeout(10 * 60_000) });
    const data = await runner.json() as { error?:string };
    if (!runner.ok) throw new Error(data.error || "Local runner failed");
    return Response.json(data);
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Fix preparation failed" }, { status:502 });
  }
}
