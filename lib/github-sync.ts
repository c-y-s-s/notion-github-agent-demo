import { alignNotionTaskWithGithubIssue, appendGithubLinkToNotionTask, createNotionTaskFromGithubIssue, queryNotionTasks } from "./notion";
import { getGithubEvidenceSet } from "./github";

export type GithubIssueCandidate = { number:number; title:string; url:string; repositoryUrl:string; workType:string; labels:string[] };

export function mapIssueWorkType(labels:string[]) {
  const values = new Set(labels.map((label) => label.toLowerCase()));
  if ([...values].some((label) => label === "bug" || label.includes("bug"))) return "Bug";
  if ([...values].some((label) => label === "documentation" || label === "docs")) return "Docs";
  if ([...values].some((label) => label === "research" || label.includes("research"))) return "Research";
  if ([...values].some((label) => label === "chore" || label.includes("maintenance"))) return "Chore";
  return "Feature";
}

function repositoryName() {
  const value = process.env.GITHUB_SYNC_REPOSITORY || "c-y-s-s/notion-github-agent-demo";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) throw new Error("invalid_github_repository");
  return value;
}

async function listIssues(state:"open"|"all"="open"):Promise<GithubIssueCandidate[]> {
  const repository = repositoryName();
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=${state}&per_page=100`, {
    headers:{ Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2026-03-10", "User-Agent":"traceboard-local-demo", ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    cache:"no-store",
  });
  if (!response.ok) throw new Error(`github_http_${response.status}`);
  const rows = await response.json() as Array<{number:number;title:string;html_url:string;pull_request?:unknown;labels:Array<string|{name?:string}>}>;
  const repositoryUrl = `https://github.com/${repository}`;
  return rows.filter((row) => !row.pull_request).map((row) => {
    const labels = row.labels.map((label) => typeof label === "string" ? label : label.name || "").filter(Boolean);
    return { number:row.number, title:row.title, url:row.html_url, repositoryUrl, labels, workType:mapIssueWorkType(labels) };
  });
}

export async function getGithubIssueSyncPlan() {
  const [issues, notion] = await Promise.all([listIssues(), queryNotionTasks()]);
  if (!notion.configured) throw new Error("notion_not_configured");
  const existingLinks = new Set(notion.tasks.flatMap((task) => task.githubLinks));
  const missing = issues.filter((issue) => !existingLinks.has(issue.url));
  return { repository:repositoryName(), total:issues.length, existing:issues.length - missing.length, missing };
}

export async function syncGithubIssuesToNotion(issueNumbers:number[]) {
  const plan = await getGithubIssueSyncPlan();
  const requested = new Set(issueNumbers);
  const targets = plan.missing.filter((issue) => requested.has(issue.number));
  const created = [] as Array<{number:number;title:string;notionUrl:string}>;
  for (const issue of targets) {
    const page = await createNotionTaskFromGithubIssue(issue);
    created.push({ number:issue.number, title:issue.title, notionUrl:page.url });
  }
  return { created, skipped:issueNumbers.length - created.length };
}

export async function alignExistingGithubIssuesInNotion() {
  const [issues, notion] = await Promise.all([listIssues("all"), queryNotionTasks()]);
  if (!notion.configured) throw new Error("notion_not_configured");
  const tasksByLink = new Map(notion.tasks.flatMap((task) => task.githubLinks.map((link) => [link, task] as const)));
  const aligned = [] as Array<{number:number;title:string;notionUrl:string}>;
  const linkedPullRequests = [] as Array<{number:number;url:string}>;
  for (const issue of issues) {
    const task = tasksByLink.get(issue.url);
    if (!task) continue;
    const expectedTitle = `[#${issue.number}] ${issue.title}`;
    if (task.title !== expectedTitle) {
      await alignNotionTaskWithGithubIssue(task.id, issue);
      aligned.push({ number:issue.number, title:expectedTitle, notionUrl:task.notionUrl });
    }
    const evidence = await getGithubEvidenceSet(issue.url, task.status);
    for (const item of evidence.filter((item) => item.label.startsWith("PR #") && !task.githubLinks.includes(item.url))) {
      await appendGithubLinkToNotionTask(task.id, item.url);
      linkedPullRequests.push({ number:issue.number, url:item.url });
    }
  }
  return { aligned, linkedPullRequests };
}
