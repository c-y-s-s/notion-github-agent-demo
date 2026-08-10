const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".mjs"]);
const blockedNames = [".env", "secret", "credential", "token", "private", "id_rsa", ".pem"];

export function extractSafeCodePaths(text:string) {
  const candidates = text.match(/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:tsx?|jsx?|css|json|md|mjs)/g) || [];
  return [...new Set(candidates)].filter((value) => {
    if (value.startsWith("/") || value.includes("..")) return false;
    const lower = value.toLowerCase();
    if (blockedNames.some((name) => lower.includes(name))) return false;
    const extension = `.${value.split(".").pop()?.toLowerCase()}`;
    return allowedExtensions.has(extension);
  }).slice(0, 5);
}

export function inferFallbackPaths(text:string) {
  if (/(dashboard|drawer|filter|task|介面|畫面|篩選)/i.test(text)) return ["app/page.tsx", "app/globals.css"];
  if (/(agent|openai|摘要|問答)/i.test(text)) return ["app/api/agent/route.ts", "lib/agent.ts"];
  if (/(github|pull request|\bpr\b|issue)/i.test(text)) return ["lib/github.ts", "lib/github-sync.ts"];
  if (/(notion|data source)/i.test(text)) return ["lib/notion.ts", "lib/task-data.ts"];
  return [];
}

export async function getGithubRepositoryContext(text:string) {
  const repository = process.env.GITHUB_SYNC_REPOSITORY || "c-y-s-s/notion-github-agent-demo";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("invalid_github_repository");
  const ref = process.env.GITHUB_ANALYSIS_REF || "codex/fix-real-data-multi-links";
  const token = process.env.GITHUB_TOKEN;
  const explicitPaths = extractSafeCodePaths(text);
  const primaryPaths = explicitPaths.length ? explicitPaths : inferFallbackPaths(text);
  const paths = [...new Set([...primaryPaths, "package.json"])].slice(0, 5);
  const fetched = await Promise.all(paths.map(async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, {
      headers:{ Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2026-03-10", "User-Agent":"traceboard-local-demo", ...(token ? { Authorization:`Bearer ${token}` } : {}) },
      cache:"no-store",
    });
    if (!response.ok) return null;
    const data = await response.json() as { type?:string; encoding?:string; content?:string; size?:number };
    if (data.type !== "file" || data.encoding !== "base64" || !data.content || (data.size || 0) > 80_000) return null;
    return { path, content:atob(data.content.replace(/\n/g, "")) };
  }));
  let remaining = 64_000;
  const files = fetched.filter((file):file is {path:string;content:string} => file !== null).flatMap((file) => {
    if (remaining <= 0) return [];
    const content = file.content.slice(0, remaining);
    remaining -= content.length;
    return [{ path:file.path, content, truncated:content.length < file.content.length }];
  });
  return { repository, ref, files };
}
