import { getAgentEvaluation } from "../../../lib/agent-runs";

export async function GET() {
  try { return Response.json(await getAgentEvaluation()); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Evaluation unavailable" }, { status:503 }); }
}
