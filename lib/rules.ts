import type { GithubEvidence } from "./github";

export type TaskAnalysis = {
  code: "insufficient_evidence" | "consistent" | "likely_in_progress" | "possibly_complete" | "status_conflict";
  severity: "none" | "info" | "warning" | "conflict";
  summary: string;
  suggestedStatus: "未開始" | "執行中" | "已完成" | null;
  confidence: number;
  ruleVersion: "1.1";
};

export function analyzeTaskEvidence(status: string, evidence: GithubEvidence[]): TaskAnalysis {
  if (!evidence.length) return { code:"insufficient_evidence", severity:"info", summary:"沒有 Issue 或 PR 證據，無法判斷開發階段。", suggestedStatus:null, confidence:0.25, ruleVersion:"1.1" };
  const phases = new Set(evidence.map((item) => item.phase));
  const blocked = ["ci_failed", "changes_requested", "closed_unmerged"].some((phase) => phases.has(phase as GithubEvidence["phase"]));
  const active = ["draft", "open", "waiting_review", "changes_requested", "ci_failed"].some((phase) => phases.has(phase as GithubEvidence["phase"]));
  const merged = phases.has("merged");
  const issueOpen = phases.has("issue_open");

  if (status === "已完成" && (blocked || (active && !merged) || (issueOpen && !merged))) {
    return { code:"status_conflict", severity:"conflict", summary:"Notion 已完成，但 GitHub 仍有未完成或阻塞證據。", suggestedStatus:"執行中", confidence:0.85, ruleVersion:"1.1" };
  }
  if ((status === "未開始" || status === "執行中") && merged) {
    return { code:"possibly_complete", severity:"warning", summary:"PR 已合併；可能完成，但仍需確認部署、QA 或驗收。", suggestedStatus:"已完成", confidence:0.65, ruleVersion:"1.1" };
  }
  if (status === "未開始" && active) {
    return { code:"likely_in_progress", severity:"warning", summary:"已有 PR 開發活動；Notion 可能應更新為執行中。", suggestedStatus:"執行中", confidence:0.9, ruleVersion:"1.1" };
  }
  return { code:"consistent", severity:"none", summary:"目前沒有明確的狀態矛盾。", suggestedStatus:null, confidence:0.8, ruleVersion:"1.1" };
}
