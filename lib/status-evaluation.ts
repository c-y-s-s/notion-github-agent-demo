import { evaluateCases } from "./agent-evaluation";
import { analyzeTaskEvidence } from "./rules";
import type { GithubEvidence } from "./github";

type Status = "未開始" | "執行中" | "已完成";

const evidence = (phase:GithubEvidence["phase"]):GithubEvidence => ({
  label:phase, detail:`Evaluation fixture: ${phase}`, tone:"neutral",
  url:"https://github.com/example/repo/issues/1", conflict:false, phase,
});

export const statusEvaluationCases = [
  { id:"no-evidence", description:"沒有 GitHub 證據時不臆測狀態", input:{ status:"未開始" as Status, evidence:[] }, expected:{ code:"insufficient_evidence", suggestedStatus:null } },
  { id:"draft-started", description:"Draft PR 表示工作已開始", input:{ status:"未開始" as Status, evidence:[evidence("draft")] }, expected:{ code:"likely_in_progress", suggestedStatus:"執行中" as Status } },
  { id:"open-pr-started", description:"Open PR 與未開始狀態矛盾", input:{ status:"未開始" as Status, evidence:[evidence("open")] }, expected:{ code:"likely_in_progress", suggestedStatus:"執行中" as Status } },
  { id:"merged-needs-acceptance", description:"PR merged 後仍需產品驗收", input:{ status:"執行中" as Status, evidence:[evidence("merged")] }, expected:{ code:"possibly_complete", suggestedStatus:"已完成" as Status } },
  { id:"completed-but-ci-failed", description:"CI 失敗不可維持已完成", input:{ status:"已完成" as Status, evidence:[evidence("ci_failed")] }, expected:{ code:"status_conflict", suggestedStatus:"執行中" as Status } },
  { id:"completed-but-changes-requested", description:"要求修改不可維持已完成", input:{ status:"已完成" as Status, evidence:[evidence("changes_requested")] }, expected:{ code:"status_conflict", suggestedStatus:"執行中" as Status } },
  { id:"active-consistent", description:"執行中搭配 Open PR 狀態一致", input:{ status:"執行中" as Status, evidence:[evidence("open")] }, expected:{ code:"consistent", suggestedStatus:null } },
];

export function runStatusEvaluation() {
  return evaluateCases(
    statusEvaluationCases,
    ({ status, evidence }) => analyzeTaskEvidence(status, evidence),
    (actual, expected) => actual.code === expected.code && actual.suggestedStatus === expected.suggestedStatus,
  );
}
