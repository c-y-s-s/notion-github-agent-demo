export type GithubEvidence = {
  label: string;
  detail: string;
  tone: "neutral" | "review" | "success" | "risk";
  phase: "issue_open" | "issue_closed" | "draft" | "open" | "waiting_review" | "changes_requested" | "ci_failed" | "merged" | "closed_unmerged";
  url: string;
  conflict: boolean;
};

const responseCache = new Map<string, { expiresAt:number; value:unknown }>();
const cacheTtl = Number(process.env.GITHUB_CACHE_TTL_MS || 60_000);

type GithubLink = { owner: string; repo: string; kind: "issues" | "pull"; number: number; url: string };

function parseGithubLink(value: string): GithubLink | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const [owner, repo, kind, rawNumber] = url.pathname.split("/").filter(Boolean);
    const number = Number(rawNumber);
    if (!owner || !repo || (kind !== "issues" && kind !== "pull") || !Number.isInteger(number) || number < 1) return null;
    return { owner, repo, kind, number, url: `https://github.com/${owner}/${repo}/${kind}/${number}` };
  } catch {
    return null;
  }
}

function headers() {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "traceboard-local-demo",
  };
  if (process.env.GITHUB_TOKEN) result.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return result;
}

async function githubFetch<T>(path: string): Promise<T> {
  const cached = responseCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  const response = await fetch(`https://api.github.com${path}`, { headers: headers(), cache: "no-store" });
  if (!response.ok) {
    const rateLimited = response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
    throw new Error(rateLimited ? "rate_limited" : response.status === 404 ? "not_found_or_no_permission" : `github_http_${response.status}`);
  }
  const value = await response.json() as T;
  responseCache.set(path, { expiresAt: Date.now() + cacheTtl, value });
  return value;
}

export async function getGithubEvidence(value: string, notionStatus: string): Promise<GithubEvidence | null> {
  const link = parseGithubLink(value);
  if (!link) return null;
  const base = `/repos/${encodeURIComponent(link.owner)}/${encodeURIComponent(link.repo)}`;

  if (link.kind === "issues") {
    const issue = await githubFetch<{ state:string; state_reason?:string | null }>(`${base}/issues/${link.number}`);
    const closed = issue.state === "closed";
    return {
      label: `Issue #${link.number}`,
      detail: closed ? `Issue 已關閉${issue.state_reason ? ` · ${issue.state_reason}` : ""}` : "Issue 開啟中",
      tone: closed ? "success" : "neutral",
      phase: closed ? "issue_closed" : "issue_open",
      url: link.url,
      conflict: notionStatus === "已完成" && !closed,
    };
  }

  const pr = await githubFetch<{
    state:string; draft?:boolean; merged?:boolean; merged_at?:string | null; head:{sha:string};
    requested_reviewers?:Array<{login:string}>;
  }>(`${base}/pulls/${link.number}`);

  const [reviewsResult, checksResult] = await Promise.allSettled([
    githubFetch<Array<{ user?:{login?:string}; state:string; submitted_at?:string }>>(`${base}/pulls/${link.number}/reviews?per_page=100`),
    githubFetch<{ check_runs?:Array<{ status:string; conclusion:string | null }> }>(`${base}/commits/${pr.head.sha}/check-runs?per_page=100`),
  ]);

  const reviews = reviewsResult.status === "fulfilled" ? reviewsResult.value : [];
  const latestReviewByUser = new Map<string, { state:string; submitted_at?:string }>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (login && review.state !== "COMMENTED" && review.state !== "PENDING") latestReviewByUser.set(login, review);
  }
  const latestReviews = [...latestReviewByUser.values()];
  const changesRequested = latestReviews.some((review) => review.state === "CHANGES_REQUESTED");
  const checks = checksResult.status === "fulfilled" ? checksResult.value.check_runs || [] : [];
  const checksFailed = checks.some((check) => ["failure", "timed_out", "cancelled", "action_required"].includes(check.conclusion || ""));

  let phase: GithubEvidence["phase"] = "open";
  let detail = "PR 開啟中";
  let tone: GithubEvidence["tone"] = "neutral";
  if (pr.merged || pr.merged_at) { phase = "merged"; detail = "PR 已合併 · 待驗收"; tone = "success"; }
  else if (pr.state === "closed") { phase = "closed_unmerged"; detail = "PR 已關閉但未合併"; tone = "risk"; }
  else if (checksFailed) { phase = "ci_failed"; detail = "CI Checks 失敗"; tone = "risk"; }
  else if (changesRequested) { phase = "changes_requested"; detail = "Review 要求修改"; tone = "risk"; }
  else if (pr.draft) { phase = "draft"; detail = "Draft PR · 開發中"; }
  else if ((pr.requested_reviewers || []).length > 0) { phase = "waiting_review"; detail = `等待 Review · ${(pr.requested_reviewers || []).length} 人`; tone = "review"; }

  return {
    label: `PR #${link.number}`,
    detail,
    tone,
    phase,
    url: link.url,
    conflict: notionStatus === "已完成" && phase !== "merged",
  };
}
