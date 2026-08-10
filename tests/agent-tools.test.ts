import assert from "node:assert/strict";
import test from "node:test";
import { runAgentTool } from "../lib/agent";

const dataset = {
  configured:true as const,
  period:{ today:"2026-08-10", start:"2026-08-10", end:"2026-08-16", timeZone:"Asia/Taipei", label:"8/10—8/16" },
  tasks:[
    { title:"Due", project:"A", status:"執行中" as const, due:"8/12", dueRaw:"2026-08-12", completedAt:null, repositoryUrl:null, githubLinks:[], notionUrl:"https://notion.so/due", computedTags:["due_this_week" as const], githubEvidence:[], githubErrors:[], analysis:{code:"consistent" as const,severity:"none" as const,summary:"ok"} },
    { title:"No due", project:"A", status:"未開始" as const, due:"未設定", dueRaw:null, completedAt:null, repositoryUrl:null, githubLinks:[], notionUrl:"https://notion.so/no-due", computedTags:["no_due" as const], githubEvidence:[], githubErrors:[], analysis:{code:"insufficient_evidence" as const,severity:"info" as const,summary:"none"} },
  ],
};

test("this_week scope never returns unrelated no-due tasks", async () => {
  const result = await runAgentTool("query_tasks", { project:null, scope:"this_week" }, dataset);
  assert.equal("count" in result ? result.count : -1, 1);
  assert.deepEqual("tasks" in result ? result.tasks.map((task) => task.title) : [], ["Due"]);
});
