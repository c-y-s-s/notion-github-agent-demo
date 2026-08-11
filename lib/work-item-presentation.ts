import type { AcceptanceStatus, EngineeringStatus } from "./work-item-state";

export type WorkItemAction = "analyze"|"open_pr"|"none";

export function getWorkItemPresentation(item:{engineeringStatus:EngineeringStatus;acceptanceStatus:AcceptanceStatus;pullRequestUrl?:string|null}|null) {
  if (!item) return { progress:"尚未建立流程", nextLabel:"Agent 分析", action:"analyze" as WorkItemAction };
  if (item.acceptanceStatus === "accepted") {
    if (["issue_open", "pr_draft", "pr_open"].includes(item.engineeringStatus)) return { progress:"已驗收，但工程狀態未結束", nextLabel:"檢查 GitHub", action:item.pullRequestUrl ? "open_pr" as WorkItemAction : "none" as WorkItemAction };
    return { progress:"已完成", nextLabel:"無待辦", action:"none" as WorkItemAction };
  }
  const states:Record<EngineeringStatus,{progress:string;nextLabel:string;action:WorkItemAction}> = {
    issue_open:{ progress:"Issue 待分析", nextLabel:"Agent 分析", action:"analyze" },
    issue_closed:{ progress:"Issue 已關閉", nextLabel:"確認是否結案", action:"none" },
    analyzing:{ progress:"Agent 分析中", nextLabel:"等待分析完成", action:"none" },
    plan_ready:{ progress:"修改計畫已完成", nextLabel:"重新開啟分析", action:"analyze" },
    blocked:{ progress:"需要人工補充", nextLabel:"重新分析", action:"analyze" },
    fixing:{ progress:"Coding Agent 執行中", nextLabel:"等待修改完成", action:"none" },
    tests_failed:{ progress:"自動測試失敗", nextLabel:"重新分析", action:"analyze" },
    awaiting_push_approval:{ progress:"修正等待確認", nextLabel:"重新開啟修正流程", action:"analyze" },
    push_failed:{ progress:"Push 失敗", nextLabel:"重新執行修正", action:"analyze" },
    pr_draft:{ progress:"Draft PR 已建立", nextLabel:"查看 PR", action:item.pullRequestUrl ? "open_pr" : "none" },
    pr_open:{ progress:"PR 等待 Review", nextLabel:"查看 PR", action:item.pullRequestUrl ? "open_pr" : "none" },
    pr_merged:{ progress:"程式已合併", nextLabel:"等待驗收", action:"none" },
    pr_closed:{ progress:"PR 已關閉", nextLabel:"重新分析", action:"analyze" },
  };
  return states[item.engineeringStatus];
}
