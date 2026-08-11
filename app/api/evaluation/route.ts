import { getAgentEvaluation } from "../../../lib/agent-runs";
import { runStatusEvaluation } from "../../../lib/status-evaluation";

export async function GET() {
  try { return Response.json({ ...(await getAgentEvaluation()), benchmark:runStatusEvaluation() }); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Evaluation unavailable" }, { status:503 }); }
}
