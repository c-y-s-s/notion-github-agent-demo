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

export type EvaluationCase<TInput, TExpected> = {
  id:string; description:string; input:TInput; expected:TExpected;
};

export function evaluateCases<TInput, TExpected, TActual>(
  cases:Array<EvaluationCase<TInput, TExpected>>,
  run:(input:TInput)=>TActual,
  matches:(actual:TActual, expected:TExpected)=>boolean,
) {
  const results = cases.map((testCase) => {
    const actual = run(testCase.input);
    return { id:testCase.id, description:testCase.description, passed:matches(actual, testCase.expected), expected:testCase.expected, actual };
  });
  const passed = results.filter((result) => result.passed).length;
  return { total:results.length, passed, passRate:results.length ? passed / results.length : 0, results };
}
