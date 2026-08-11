import assert from "node:assert/strict";
import test from "node:test";
import { getWorkItemPresentation } from "../lib/work-item-presentation";

test("offers one executable action for an open issue", () => {
  assert.deepEqual(getWorkItemPresentation({ engineeringStatus:"issue_open", acceptanceStatus:"not_started" }), {
    progress:"Issue 待分析", nextLabel:"Agent 分析", action:"analyze",
  });
});

test("links to a draft PR instead of offering another Agent action", () => {
  assert.deepEqual(getWorkItemPresentation({ engineeringStatus:"pr_draft", acceptanceStatus:"in_progress", pullRequestUrl:"https://github.com/o/r/pull/3" }), {
    progress:"Draft PR 已建立", nextLabel:"查看 PR", action:"open_pr",
  });
});

test("does not expose a fake acceptance button after merge", () => {
  assert.deepEqual(getWorkItemPresentation({ engineeringStatus:"pr_merged", acceptanceStatus:"awaiting_acceptance" }), {
    progress:"程式已合併", nextLabel:"等待驗收", action:"none",
  });
});

test("surfaces conflicts between accepted work and open engineering state", () => {
  assert.deepEqual(getWorkItemPresentation({ engineeringStatus:"issue_open", acceptanceStatus:"accepted" }), {
    progress:"已驗收，但工程狀態未結束", nextLabel:"檢查 GitHub", action:"none",
  });
});
