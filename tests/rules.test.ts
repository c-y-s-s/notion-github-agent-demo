import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTaskEvidence } from "../lib/rules";
import type { GithubEvidence } from "../lib/github";

const evidence = (phase:GithubEvidence["phase"]):GithubEvidence => ({ label:"PR #1", detail:phase, tone:"neutral", phase, url:"https://github.com/a/b/pull/1", conflict:false });

test("suggests in-progress when an unstarted task has an active PR", () => {
  const result = analyzeTaskEvidence("未開始", [evidence("draft")]);
  assert.equal(result.code, "likely_in_progress");
  assert.equal(result.suggestedStatus, "執行中");
  assert.equal(result.confidence, 0.9);
});

test("never equates merged directly with business completion", () => {
  const result = analyzeTaskEvidence("執行中", [evidence("merged")]);
  assert.equal(result.code, "possibly_complete");
  assert.equal(result.severity, "warning");
  assert.equal(result.suggestedStatus, "已完成");
  assert.equal(result.confidence, 0.65);
});

test("flags completed tasks with failing CI", () => {
  const result = analyzeTaskEvidence("已完成", [evidence("ci_failed")]);
  assert.equal(result.severity, "conflict");
  assert.equal(result.suggestedStatus, "執行中");
  assert.equal(result.confidence, 0.85);
});

test("does not suggest a status without evidence", () => {
  const result = analyzeTaskEvidence("未開始", []);
  assert.equal(result.suggestedStatus, null);
  assert.equal(result.confidence, 0.25);
});
