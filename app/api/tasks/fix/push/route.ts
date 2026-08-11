export async function POST(request:Request) {
  try {
    const host = new URL(request.url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return Response.json({ error:"local_only" }, { status:403 });
    const { taskId, pushToken } = await request.json() as { taskId?:string; pushToken?:string };
    if (!taskId || !pushToken) return Response.json({ error:"invalid_request" }, { status:400 });
    const runner = await fetch("http://127.0.0.1:4319/push", { method:"POST", headers:{ "Content-Type":"application/json", "X-Traceboard-Runner":"1" }, body:JSON.stringify({ taskId, pushToken }), signal:AbortSignal.timeout(3 * 60_000) });
    const data = await runner.json() as { error?:string };
    if (!runner.ok) throw new Error(data.error || "Local runner failed");
    return Response.json(data);
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Push failed" }, { status:502 });
  }
}
