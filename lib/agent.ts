import { getTaskDataset } from "./task-data";

type Dataset = Awaited<ReturnType<typeof getTaskDataset>>;
type ToolName = "query_tasks" | "find_overdue_tasks" | "find_status_conflicts" | "generate_weekly_summary";

const definitions = ([
  ["query_tasks", "查詢真實 Notion Task 與 GitHub 證據。必須用 scope 限制查詢範圍；使用者提到本週時用 this_week。", true],
  ["find_overdue_tasks", "找出截止日已過且尚未完成的 Task。"],
  ["find_status_conflicts", "找出 Notion 狀態與 GitHub 證據的矛盾或待確認項目。"],
  ["generate_weekly_summary", "計算本週預計、本週完成、逾期與無期限摘要。"],
] as const);

export const agentTools = definitions.map(([name, description, hasScope]) => ({
  type:"function", name, description, strict:true,
  parameters:{
    type:"object",
    properties:{
      project:{ type:["string","null"], description:"專案名稱；沒有指定時傳 null。" },
      ...(hasScope ? { scope:{ type:"string", enum:["all","this_week","due_this_week","completed_this_week","overdue","no_due"], description:"查詢範圍。this_week 包含本週到期或本週完成。" } } : {}),
    },
    required:hasScope ? ["project","scope"] : ["project"],
    additionalProperties:false,
  },
}));

function publicTask(task: Dataset["tasks"][number]) {
  return {
    title:task.title, project:task.project, status:task.status, due:task.dueRaw,
    completed_at:task.completedAt, tags:task.computedTags, analysis:task.analysis,
    notion_url:task.notionUrl,
    github_evidence:task.githubEvidence.map((item) => ({ label:item.label, detail:item.detail, phase:item.phase, url:item.url })),
    github_errors:task.githubErrors,
  };
}

export async function runAgentTool(name:ToolName, args:{project:string|null;scope?:string}, dataset?:Dataset) {
  const data = dataset || await getTaskDataset();
  if (!data.configured || !data.period) return { error:"notion_not_configured" };
  let tasks = data.tasks.filter((task) => !args.project || task.project === args.project);
  if (name === "query_tasks") {
    const tagByScope = { due_this_week:"due_this_week", completed_this_week:"completed_this_week", overdue:"overdue", no_due:"no_due" } as const;
    if (args.scope === "this_week") tasks = tasks.filter((task) => task.computedTags.includes("due_this_week") || task.computedTags.includes("completed_this_week"));
    else if (args.scope && args.scope !== "all") tasks = tasks.filter((task) => task.computedTags.includes(tagByScope[args.scope as keyof typeof tagByScope]));
    return { period:data.period, scope:args.scope || "all", count:tasks.length, tasks:tasks.map(publicTask) };
  }
  if (name === "find_overdue_tasks") return { period:data.period, tasks:tasks.filter((task) => task.computedTags.includes("overdue")).map(publicTask) };
  if (name === "find_status_conflicts") return { tasks:tasks.filter((task) => ["warning","conflict"].includes(task.analysis.severity)).map(publicTask) };
  return {
    period:data.period,
    counts:{
      all:tasks.length,
      due_this_week:tasks.filter((task) => task.computedTags.includes("due_this_week")).length,
      completed_this_week:tasks.filter((task) => task.computedTags.includes("completed_this_week")).length,
      overdue:tasks.filter((task) => task.computedTags.includes("overdue")).length,
      no_due:tasks.filter((task) => task.computedTags.includes("no_due")).length,
      needs_confirmation:tasks.filter((task) => ["warning","conflict"].includes(task.analysis.severity)).length,
    },
    tasks:tasks.map(publicTask),
  };
}
