import { getTaskDataset } from "./task-data";

type Dataset = Awaited<ReturnType<typeof getTaskDataset>>;

function escapeSlack(value:string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function taskLink(task:Dataset["tasks"][number]) {
  const title = escapeSlack(task.title);
  return task.notionUrl ? `<${task.notionUrl}|${title}>` : title;
}

export function buildSlackDailyBrief(data:Dataset) {
  if (!data.configured || !data.period) throw new Error("notion_not_configured");
  const active = data.tasks.filter((task) => task.status !== "已完成");
  const dueToday = active.filter((task) => task.dueRaw?.slice(0, 10) === data.period!.today);
  const overdue = active.filter((task) => task.computedTags.includes("overdue"));
  const confirmation = data.tasks.filter((task) => ["warning", "conflict"].includes(task.analysis.severity));
  const priority = [...overdue, ...dueToday, ...confirmation]
    .filter((task, index, all) => all.findIndex((candidate) => candidate.id === task.id) === index)
    .slice(0, 3);
  const lines = priority.length
    ? priority.map((task, index) => {
        const reason = task.computedTags.includes("overdue") ? `已逾期（${task.due}）` : task.dueRaw?.slice(0, 10) === data.period!.today ? "今天到期" : task.analysis.summary;
        return `${index + 1}. ${taskLink(task)} · ${escapeSlack(task.project)} — ${escapeSlack(reason)}`;
      })
    : ["今天沒有偵測到需要立即處理的項目。"];
  const text = `每日工作摘要 ${data.period.today}\n今天到期 ${dueToday.length}｜逾期 ${overdue.length}｜需要確認 ${confirmation.length}\n${lines.join("\n")}`;
  return {
    text,
    blocks:[
      { type:"header", text:{ type:"plain_text", text:`每日工作摘要 · ${data.period.today}`, emoji:true } },
      { type:"section", fields:[
        { type:"mrkdwn", text:`*今天到期*\n${dueToday.length}` },
        { type:"mrkdwn", text:`*已逾期*\n${overdue.length}` },
        { type:"mrkdwn", text:`*需要確認*\n${confirmation.length}` },
      ] },
      { type:"section", text:{ type:"mrkdwn", text:`*今日優先行動*\n${lines.join("\n")}` } },
      { type:"context", elements:[{ type:"mrkdwn", text:"Traceboard 僅提供建議，不會自動修改 Notion。" }] },
    ],
  };
}

export async function sendSlackDailyBrief() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("slack_not_configured");
  const data = await getTaskDataset();
  const payload = buildSlackDailyBrief(data);
  const response = await fetch(webhookUrl, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Slack HTTP ${response.status}: ${(await response.text()).slice(0, 120)}`);
  return { sent:true, date:data.period?.today, counts:{ tasks:data.tasks.length } };
}
