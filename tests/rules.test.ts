import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTaskEvidence } from "../lib/rules";
import type { GithubEvidence } from "../lib/github";

const evidence = (phase:GithubEvidence["phase"]):GithubEvidence => ({ label:"PR #1", detail:phase, tone:"neutral", phase, url:"https://github.com/a/b/pull/1", conflict:false });

test("suggests in-progress when an unstarted task has an active PR", () => {
  assert.equal(analyzeTaskEvidence("未開始", [evidence("draft")]).code, "likely_in_progress");
});

test("never equates merged directly with business completion", () => {
  const result = analyzeTaskEvidence("執行中", [evidence("merged")]);
  assert.equal(result.code, "possibly_complete");
  assert.equal(result.severity, "warning");
});

test("flags completed tasks with failing CI", () => {
  assert.equal(analyzeTaskEvidence("已完成", [evidence("ci_failed")]).severity, "conflict");
});
