export const engineeringStatuses = ["issue_open", "issue_closed", "analyzing", "plan_ready", "blocked", "fixing", "tests_failed", "awaiting_push_approval", "push_failed", "pr_draft", "pr_open", "pr_merged", "pr_closed"] as const;
export const acceptanceStatuses = ["not_started", "in_progress", "awaiting_acceptance", "accepted", "rejected"] as const;

export type EngineeringStatus = typeof engineeringStatuses[number];
export type AcceptanceStatus = typeof acceptanceStatuses[number];

const engineeringTransitions:Record<EngineeringStatus,EngineeringStatus[]> = {
  issue_open:["analyzing", "issue_closed"],
  issue_closed:["issue_open", "analyzing"],
  analyzing:["plan_ready", "blocked"],
  plan_ready:["analyzing", "fixing", "blocked"],
  blocked:["analyzing", "plan_ready", "fixing"],
  fixing:["tests_failed", "awaiting_push_approval", "blocked"],
  tests_failed:["fixing", "plan_ready", "blocked"],
  awaiting_push_approval:["fixing", "push_failed", "pr_draft"],
  push_failed:["awaiting_push_approval", "fixing", "pr_draft"],
  pr_draft:["pr_open", "pr_merged", "pr_closed"],
  pr_open:["pr_merged", "pr_closed"],
  pr_merged:[],
  pr_closed:["fixing", "plan_ready"],
};

export function deriveEngineeringStatus(phases:string[]):EngineeringStatus {
  if (phases.includes("merged")) return "pr_merged";
  if (phases.includes("draft")) return "pr_draft";
  if (phases.some((phase) => ["open", "waiting_review", "changes_requested", "ci_failed"].includes(phase))) return "pr_open";
  if (phases.includes("closed_unmerged")) return "pr_closed";
  if (phases.includes("issue_closed")) return "issue_closed";
  return "issue_open";
}

export function deriveAcceptanceStatus(status:string):AcceptanceStatus {
  if (status === "已完成") return "accepted";
  if (status === "執行中") return "in_progress";
  return "not_started";
}

const acceptanceTransitions:Record<AcceptanceStatus,AcceptanceStatus[]> = {
  not_started:["in_progress"],
  in_progress:["awaiting_acceptance"],
  awaiting_acceptance:["accepted", "rejected"],
  accepted:[],
  rejected:["in_progress"],
};

export function canTransitionEngineering(from:EngineeringStatus, to:EngineeringStatus) {
  return from === to || engineeringTransitions[from].includes(to);
}

export function canTransitionAcceptance(from:AcceptanceStatus, to:AcceptanceStatus) {
  return from === to || acceptanceTransitions[from].includes(to);
}
