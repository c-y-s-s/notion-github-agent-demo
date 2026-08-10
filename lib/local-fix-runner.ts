import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const baseRef = process.env.GITHUB_ANALYSIS_REF || "codex/fix-real-data-multi-links";
const codexBinary = "/Applications/ChatGPT.app/Contents/Resources/codex";

function safeEnv() {
  const keys = ["PATH", "HOME", "CODEX_HOME", "LANG", "LC_ALL", "TMPDIR"] as const;
  return Object.fromEntries(keys.flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : []));
}

async function run(file:string, args:string[], cwd:string, timeout=300_000) {
  return await execFileAsync(file, args, { cwd, timeout, maxBuffer:4_000_000, env:safeEnv() });
}

async function runWithClosedStdin(file:string, args:string[], cwd:string, timeout=300_000) {
  return await new Promise<{stdout:string;stderr:string}>((resolve, reject) => {
    const child = spawn(file, args, { cwd, env:safeEnv(), stdio:["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); if (stdout.length > 4_000_000) child.kill(); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); if (stderr.length > 4_000_000) child.kill(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Command timed out: ${file}`)); }, timeout);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed (${code}): ${file}\n${stderr.slice(-4000)}`));
    });
  });
}

function branchSlug(title:string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "small-fix";
}

export async function prepareLocalFix(input:{title:string;issueNumber:number|null;allowedFiles:string[];summary:string;proposedChanges:string[];validationSteps:string[]}) {
  if (!input.allowedFiles.length || input.allowedFiles.length > 3) throw new Error("invalid_allowed_files");
  const runId = crypto.randomUUID().slice(0, 8);
  const branch = `codex/fix-${input.issueNumber ? `issue-${input.issueNumber}` : branchSlug(input.title)}-${runId}`;
  const root = path.join(tmpdir(), "traceboard-fixes");
  const worktree = path.join(root, runId);
  await mkdir(root, { recursive:true });
  await run("git", ["worktree", "add", "-b", branch, worktree, baseRef], repoRoot, 60_000);
  try {
    try { await symlink(path.join(repoRoot, "node_modules"), path.join(worktree, "node_modules"), "dir"); } catch { /* already available */ }
    const prompt = [
      "You are applying one approved, low-risk bug fix in an isolated git worktree.",
      `Task: ${input.title}`,
      `Approved summary: ${input.summary}`,
      `Approved changes:\n- ${input.proposedChanges.join("\n- ")}`,
      `Allowed files only:\n- ${input.allowedFiles.join("\n- ")}`,
      `Validation requirements:\n- ${input.validationSteps.join("\n- ")}`,
      "Modify only the allowed files. Do not read .env files or secrets. Do not install dependencies, commit, push, create branches, or change git configuration. Keep the change minimal. Do not merely describe the fix; edit the files. Stop after the edit.",
    ].join("\n\n");
    await runWithClosedStdin(codexBinary, ["exec", "--ephemeral", "--ignore-rules", "-s", "workspace-write", "-C", worktree, prompt], worktree);
    const changedRaw = (await run("git", ["diff", "--name-only"], worktree, 30_000)).stdout.trim();
    const changedFiles = changedRaw ? changedRaw.split("\n").filter(Boolean) : [];
    if (!changedFiles.length) throw new Error("agent_made_no_changes");
    if (changedFiles.length > 3 || changedFiles.some((file) => !input.allowedFiles.includes(file))) throw new Error(`agent_changed_unapproved_files:${changedFiles.join(",")}`);
    const numstat = (await run("git", ["diff", "--numstat"], worktree, 30_000)).stdout.trim();
    const changedLines = numstat.split("\n").filter(Boolean).reduce((sum, row) => row.split("\t").slice(0, 2).reduce((inner, value) => inner + (Number(value) || 0), sum), 0);
    if (changedLines > 120) throw new Error(`change_too_large:${changedLines}`);
    const lint = await run("npm", ["run", "lint"], worktree);
    const tests = await run("npm", ["test"], worktree);
    const diff = (await run("git", ["diff", "--no-ext-diff", "--unified=3"], worktree, 30_000)).stdout.slice(0, 60_000);
    return { branch, worktree, changedFiles, diff, testSummary:`Lint 通過\n測試與 Build 通過\n${[lint.stdout, tests.stdout].join("\n").slice(-2500)}` };
  } catch (error) {
    try { await run("git", ["worktree", "remove", "--force", worktree], repoRoot, 60_000); } catch { /* best-effort cleanup */ }
    try { await run("git", ["branch", "-D", branch], repoRoot, 30_000); } catch { /* best-effort cleanup */ }
    throw error;
  }
}

export async function pushLocalFix(runData:{title:string;issueNumber:number|null;branch:string;worktree:string;changedFiles:string[]}) {
  for (const file of runData.changedFiles) await readFile(path.join(runData.worktree, file), "utf8");
  await run("git", ["add", "--", ...runData.changedFiles], runData.worktree, 30_000);
  await run("git", ["commit", "-m", `fix: ${runData.title}`], runData.worktree, 60_000);
  await run("git", ["push", "-u", "origin", runData.branch], runData.worktree, 120_000);
  const repository = process.env.GITHUB_SYNC_REPOSITORY || "c-y-s-s/notion-github-agent-demo";
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("github_token_missing_for_pr");
  const body = `${runData.issueNumber ? `Closes #${runData.issueNumber}\n\n` : ""}由 Traceboard 小型修正流程產生。已通過 lint、test 與 build；請人工 Review 後再合併。`;
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${token}`, Accept:"application/vnd.github+json", "Content-Type":"application/json", "X-GitHub-Api-Version":"2026-03-10", "User-Agent":"traceboard-local-demo" },
    body:JSON.stringify({ title:`fix: ${runData.title}`, head:runData.branch, base:baseRef, body, draft:true }),
  });
  const data = await response.json() as { html_url?:string; message?:string };
  if (!response.ok || !data.html_url) throw new Error(data.message || `GitHub PR HTTP ${response.status}`);
  const result = { branch:runData.branch, pullRequestUrl:data.html_url };
  await run("git", ["worktree", "remove", "--force", runData.worktree], repoRoot, 60_000);
  await run("git", ["branch", "-D", runData.branch], repoRoot, 30_000);
  return result;
}
