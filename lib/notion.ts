type NotionProperty = {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  status?: { name?: string } | null;
  select?: { name?: string } | null;
  relation?: Array<{ id?: string }>;
  date?: { start?: string } | null;
  url?: string | null;
};

type NotionPage = {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
};

export type NormalizedTask = {
  id: string;
  title: string;
  project: string;
  status: "未開始" | "執行中" | "已完成";
  due: string;
  dueRaw: string | null;
  completedAt: string | null;
  repositoryUrl: string | null;
  githubLinks: string[];
  notionUrl: string;
};

const propertyNames = {
  task: process.env.NOTION_TASK_PROPERTY || "Task",
  project: process.env.NOTION_PROJECT_PROPERTY || "Project",
  status: process.env.NOTION_STATUS_PROPERTY || "Status",
  due: process.env.NOTION_DUE_DATE_PROPERTY || "Due Date",
  completedAt: process.env.NOTION_COMPLETED_AT_PROPERTY || "Completed At",
  repository: process.env.NOTION_GITHUB_REPOSITORY_PROPERTY || "GitHub Repository",
  githubLinks: process.env.NOTION_GITHUB_LINKS_PROPERTY || "GitHub Links",
};

function textValue(property?: NotionProperty) {
  return [...(property?.title || []), ...(property?.rich_text || [])]
    .map((item) => item.plain_text || "")
    .join("")
    .trim();
}

function projectValue(property?: NotionProperty) {
  return property?.select?.name || textValue(property) || (property?.relation?.length ? "已連結專案" : "未分類");
}

function normalizeStatus(value?: string): NormalizedTask["status"] {
  if (value === "已完成" || value === "Done" || value === "Complete") return "已完成";
  if (value === "執行中" || value === "In progress" || value === "In Progress") return "執行中";
  return "未開始";
}

function formatDate(value?: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", timeZone: "Asia/Taipei" }).format(new Date(value));
}

function extractUrls(property?: NotionProperty) {
  const value = property?.url || textValue(property);
  return value?.match(/https:\/\/github\.com\/[^\s,]+/g) || [];
}

function normalizePage(page: NotionPage): NormalizedTask {
  const properties = page.properties;
  const dueRaw = properties[propertyNames.due]?.date?.start || null;
  return {
    id: page.id,
    title: textValue(properties[propertyNames.task]) || "未命名 Task",
    project: projectValue(properties[propertyNames.project]),
    status: normalizeStatus(properties[propertyNames.status]?.status?.name || properties[propertyNames.status]?.select?.name),
    due: formatDate(dueRaw || undefined),
    dueRaw,
    completedAt: properties[propertyNames.completedAt]?.date?.start || null,
    repositoryUrl: properties[propertyNames.repository]?.url || null,
    githubLinks: extractUrls(properties[propertyNames.githubLinks]),
    notionUrl: page.url,
  };
}

export async function queryNotionTasks() {
  const token = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  if (!token || !dataSourceId) return { configured: false as const, tasks: [] };

  const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2026-03-11",
    },
    body: JSON.stringify({ page_size: 100 }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion API ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { results?: NotionPage[] };
  return { configured: true as const, tasks: (data.results || []).map(normalizePage) };
}

export async function createNotionTaskFromGithubIssue(issue:{ title:string; url:string; repositoryUrl:string; workType:string }) {
  const token = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  if (!token || !dataSourceId) throw new Error("notion_not_configured");
  const response = await fetch("https://api.notion.com/v1/pages", {
    method:"POST",
    headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json", "Notion-Version":"2026-03-11" },
    body:JSON.stringify({
      parent:{ data_source_id:dataSourceId },
      properties:{
        [propertyNames.task]:{ title:[{ text:{ content:issue.title } }] },
        [propertyNames.project]:{ select:{ name:process.env.NOTION_SYNC_PROJECT || "Notion GitHub Agent" } },
        [propertyNames.status]:{ status:{ name:"未開始" } },
        [process.env.NOTION_WORK_TYPE_PROPERTY || "Work Type"]:{ select:{ name:issue.workType } },
        [propertyNames.repository]:{ url:issue.repositoryUrl },
        [propertyNames.githubLinks]:{ rich_text:[{ text:{ content:issue.url, link:{ url:issue.url } } }] },
      },
    }),
    cache:"no-store",
  });
  if (!response.ok) throw new Error(`Notion create ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return await response.json() as { id:string; url:string };
}
