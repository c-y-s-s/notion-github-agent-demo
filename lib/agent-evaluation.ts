export function summarizeAgentRuns(runs:Array<{testsPassed:boolean;status:string;humanDecision:string;durationMs:number}>) {
  const total = runs.length;
  const testsPassed = runs.filter((run) => run.testsPassed).length;
  const pullRequests = runs.filter((run) => run.status === "pr_created").length;
  const accepted = runs.filter((run) => run.humanDecision === "accepted").length;
  const finished = runs.filter((run) => run.status !== "prepared");
  return {
    total,
    testsPassRate:total ? testsPassed / total : 0,
    pullRequestRate:total ? pullRequests / total : 0,
    humanAcceptanceRate:total ? accepted / total : 0,
    averageDurationMs:total ? Math.round(runs.reduce((sum, run) => sum + run.durationMs, 0) / total) : 0,
    failureCount:finished.filter((run) => run.status.endsWith("failed")).length,
  };
}
