import initialRepairBenchmark from "../../../../benchmarks/results/2026-08-11-initial.json";
import repairCases from "../../../../benchmarks/cases.json";
import { buildEvaluationReport } from "../../../../lib/evaluation-report";

export async function GET() {
  return new Response(buildEvaluationReport(initialRepairBenchmark, repairCases), {
    headers:{
      "Content-Type":"text/markdown; charset=utf-8",
      "Content-Disposition":"attachment; filename=traceboard-agent-evaluation.md",
    },
  });
}
