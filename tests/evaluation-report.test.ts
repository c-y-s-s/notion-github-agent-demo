import assert from "node:assert/strict";
import test from "node:test";
import initial from "../benchmarks/results/2026-08-11-initial.json";
import cases from "../benchmarks/cases.json";
import { buildEvaluationReport } from "../lib/evaluation-report";

test("evaluation report distinguishes initial results from selective reruns", () => {
  const report = buildEvaluationReport(initial, cases);
  assert.match(report, /7\/10（70%）/);
  assert.match(report, /B03.*首輪失敗/);
  assert.match(report, /不能解讀為完整 10 題成功率 100%/);
  assert.equal((report.match(/^\| B\d{2} /gm) || []).length, 10);
});
