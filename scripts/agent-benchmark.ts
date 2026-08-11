import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { evaluateBenchmarkCase } from "../benchmarks/hidden-evaluator";

type BenchmarkCase = { id:string;category:string;title:string;issue:string;file:string };
type Result = { id:string;category:string;passed:boolean;durationMs:number;changedFiles:string[];requiresHumanIntervention:boolean;failureReason:string|null;candidateSource?:string };
const root = process.cwd();
const cases = JSON.parse(await readFile(path.join(root, "benchmarks/cases.json"), "utf8")) as BenchmarkCase[];
const args = process.argv.slice(2);
const baseline = args.includes("--baseline");
const requested = args[args.indexOf("--case") + 1];
const requestedIds = new Set((requested || "").split(",").filter(Boolean));
const selected = baseline || args.includes("--all") ? cases : requestedIds.size ? cases.filter((item) => requestedIds.has(item.id)) : [];

if (!selected.length) throw new Error("Use --case B01, --all, or --baseline. Running paid Agent calls requires an explicit selection.");

function safeEnv() {
  const keys = ["PATH", "HOME", "CODEX_HOME", "LANG", "LC_ALL", "TMPDIR"];
  return Object.fromEntries(keys.flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : []));
}

async function run(file:string, commandArgs:string[], cwd:string, timeoutMs=180_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(file, commandArgs, { cwd, env:safeEnv(), stdio:["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    const timer = setTimeout(() => { child.kill(); reject(new Error("agent_timeout")); }, timeoutMs);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `agent_exit_${code}`));
    });
  });
}

async function runCase(testCase:BenchmarkCase):Promise<Result> {
  const startedAt = Date.now();
  const workspace = await mkdtemp(path.join(tmpdir(), `traceboard-benchmark-${testCase.id}-`));
  const target = path.join(workspace, "solution.js");
  try {
    await copyFile(path.join(root, "benchmarks/cases", testCase.file), target);
    const before = await readFile(target, "utf8");
    await writeFile(path.join(workspace, "TASK.md"), `# ${testCase.title}\n\n${testCase.issue}\n`, "utf8");
    if (baseline) {
      try { await evaluateBenchmarkCase(testCase.id, target); return { id:testCase.id, category:testCase.category, passed:false, durationMs:Date.now()-startedAt, changedFiles:[], requiresHumanIntervention:true, failureReason:"baseline_unexpectedly_passed" }; }
      catch { return { id:testCase.id, category:testCase.category, passed:true, durationMs:Date.now()-startedAt, changedFiles:[], requiresHumanIntervention:false, failureReason:null }; }
    }
    const binary = process.env.CODEX_BINARY || "/Applications/ChatGPT.app/Contents/Resources/codex";
    const prompt = `Fix the bug described in TASK.md. Modify only solution.js. Do not create files. Keep the change minimal. You cannot see the hidden acceptance tests.`;
    try { await run(binary, ["exec", "--ephemeral", "--ignore-rules", "--skip-git-repo-check", "-s", "workspace-write", "-C", workspace, prompt], workspace); }
    catch (error) { return { id:testCase.id, category:testCase.category, passed:false, durationMs:Date.now()-startedAt, changedFiles:[], requiresHumanIntervention:true, failureReason:error instanceof Error ? error.message : "runner_error" }; }
    const after = await readFile(target, "utf8");
    const entries = (await import("node:fs/promises")).readdir(workspace);
    const changedFiles = before === after ? [] : ["solution.js"];
    const unexpected = (await entries).filter((entry) => !["solution.js", "TASK.md"].includes(entry));
    if (unexpected.length) return { id:testCase.id, category:testCase.category, passed:false, durationMs:Date.now()-startedAt, changedFiles:[...changedFiles, ...unexpected], requiresHumanIntervention:true, failureReason:"scope_violation" };
    if (!changedFiles.length) return { id:testCase.id, category:testCase.category, passed:false, durationMs:Date.now()-startedAt, changedFiles, requiresHumanIntervention:true, failureReason:"no_change" };
    try {
      await evaluateBenchmarkCase(testCase.id, target);
      return { id:testCase.id, category:testCase.category, passed:true, durationMs:Date.now()-startedAt, changedFiles, requiresHumanIntervention:false, failureReason:null };
    } catch {
      return { id:testCase.id, category:testCase.category, passed:false, durationMs:Date.now()-startedAt, changedFiles, requiresHumanIntervention:true, failureReason:"hidden_tests_failed", candidateSource:after };
    }
  } finally { await rm(workspace, { recursive:true, force:true }); }
}

const results:Result[] = [];
for (const testCase of selected) {
  const result = await runCase(testCase);
  results.push(result);
  process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.id} ${result.failureReason || ""}\n`);
}
const report = {
  mode:baseline ? "baseline-validation" : "agent",
  generatedAt:new Date().toISOString(),
  model:baseline ? null : "Codex CLI default",
  metrics:baseline
    ? { total:results.length, validBugFixtures:results.filter((result) => result.passed).length, fixtureValidityRate:results.filter((result) => result.passed).length/results.length }
    : { total:results.length, repaired:results.filter((result) => result.passed).length, repairSuccessRate:results.filter((result) => result.passed).length/results.length, humanInterventionRate:results.filter((result) => result.requiresHumanIntervention).length/results.length, averageDurationMs:Math.round(results.reduce((sum, result) => sum+result.durationMs, 0)/results.length) },
  failures:Object.fromEntries([...new Set(results.map((result) => result.failureReason).filter(Boolean))].map((reason) => [reason, results.filter((result) => result.failureReason === reason).length])),
  results,
};
await mkdir(path.join(root, ".benchmark-results"), { recursive:true });
const serialized = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(path.join(root, ".benchmark-results", "latest.json"), serialized, "utf8");
await writeFile(path.join(root, ".benchmark-results", `${report.generatedAt.replace(/[:.]/g, "-")}.json`), serialized, "utf8");
process.stdout.write(`${JSON.stringify(report.metrics)}\n`);
