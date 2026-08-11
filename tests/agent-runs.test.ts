import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAgentRuns } from "../lib/agent-evaluation";

test("summarizes Agent outcomes without treating test pass as PR success", () => {
  const metrics = summarizeAgentRuns([
    { testsPassed:true, status:"pr_created", humanDecision:"accepted", durationMs:2_000 },
    { testsPassed:true, status:"prepared", humanDecision:"pending", durationMs:1_000 },
    { testsPassed:false, status:"prepare_failed", humanDecision:"pending", durationMs:3_000 },
  ]);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.testsPassRate, 2 / 3);
  assert.equal(metrics.pullRequestRate, 1 / 3);
  assert.equal(metrics.humanAcceptanceRate, 1 / 3);
  assert.equal(metrics.averageDurationMs, 2_000);
  assert.equal(metrics.failureCount, 1);
});

test("returns zeroed metrics for an empty evaluation set", () => {
  assert.deepEqual(summarizeAgentRuns([]), {
    total:0, testsPassRate:0, pullRequestRate:0, humanAcceptanceRate:0, averageDurationMs:0, failureCount:0,
  });
});
