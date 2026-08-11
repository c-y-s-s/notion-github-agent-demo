import { getAgentEvaluation } from "../../../lib/agent-runs";
import { runStatusEvaluation } from "../../../lib/status-evaluation";
import initialRepairBenchmark from "../../../benchmarks/results/2026-08-11-initial.json";
import specificationRevision from "../../../benchmarks/results/2026-08-11-spec-revision.json";
import repairCases from "../../../benchmarks/cases.json";

export async function GET() {
  try {
    return Response.json({
      ...(await getAgentEvaluation()),
      benchmark:runStatusEvaluation(),
      repairBenchmark:{ initial:initialRepairBenchmark, specificationRevision, cases:repairCases },
    });
  }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Evaluation unavailable" }, { status:503 }); }
}
