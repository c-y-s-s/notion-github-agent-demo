import assert from "node:assert/strict";
import test from "node:test";
import { runStatusEvaluation } from "../lib/status-evaluation";

test("status benchmark remains fully passing", () => {
  const benchmark = runStatusEvaluation();
  assert.equal(benchmark.total, 7);
  assert.equal(benchmark.passed, benchmark.total, benchmark.results.filter((result) => !result.passed).map((result) => result.id).join(", "));
});
