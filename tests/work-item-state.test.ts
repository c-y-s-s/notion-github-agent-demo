import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionAcceptance, canTransitionEngineering, deriveAcceptanceStatus, deriveEngineeringStatus } from "../lib/work-item-state";

test("allows the approved engineering workflow", () => {
  assert.equal(canTransitionEngineering("issue_open", "analyzing"), true);
  assert.equal(canTransitionEngineering("analyzing", "plan_ready"), true);
  assert.equal(canTransitionEngineering("plan_ready", "fixing"), true);
  assert.equal(canTransitionEngineering("fixing", "awaiting_push_approval"), true);
  assert.equal(canTransitionEngineering("awaiting_push_approval", "pr_draft"), true);
  assert.equal(canTransitionEngineering("pr_draft", "pr_merged"), true);
});

test("reconciles external GitHub and Notion facts without guessing from titles", () => {
  assert.equal(deriveEngineeringStatus(["issue_closed", "merged"]), "pr_merged");
  assert.equal(deriveEngineeringStatus(["issue_open", "draft"]), "pr_draft");
  assert.equal(deriveEngineeringStatus(["issue_closed"]), "issue_closed");
  assert.equal(deriveAcceptanceStatus("已完成"), "accepted");
  assert.equal(deriveAcceptanceStatus("執行中"), "in_progress");
});

test("rejects engineering shortcuts that bypass approval", () => {
  assert.equal(canTransitionEngineering("issue_open", "fixing"), false);
  assert.equal(canTransitionEngineering("plan_ready", "pr_draft"), false);
  assert.equal(canTransitionEngineering("fixing", "pr_merged"), false);
  assert.equal(canTransitionEngineering("pr_merged", "fixing"), false);
});

test("keeps acceptance independent from engineering completion", () => {
  assert.equal(canTransitionAcceptance("not_started", "in_progress"), true);
  assert.equal(canTransitionAcceptance("in_progress", "accepted"), false);
  assert.equal(canTransitionAcceptance("in_progress", "awaiting_acceptance"), true);
  assert.equal(canTransitionAcceptance("awaiting_acceptance", "accepted"), true);
  assert.equal(canTransitionAcceptance("rejected", "in_progress"), true);
});
