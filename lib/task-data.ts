import { queryNotionTasks } from "./notion";
import { getGithubEvidenceSet } from "./github";
import { classifyTask, formatWeekLabel, getWeekPeriod } from "./date";
import { analyzeTaskEvidence } from "./rules";

export async function getTaskDataset() {
  const result = await queryNotionTasks();
  if (!result.configured) return { configured:false as const, period:null, tasks:[] };
  const period = getWeekPeriod();
  const tasks = await Promise.all(result.tasks.map(async (task) => {
    const results = await Promise.all(task.githubLinks.map(async (link) => {
      try { return { link, evidence:await getGithubEvidenceSet(link, task.status), error:null }; }
      catch (error) { return { link, evidence:null, error:error instanceof Error ? error.message : "GitHub query failed" }; }
    }));
    const evidence = results.flatMap((item) => item.evidence || []);
    return {
      ...task,
      computedTags:classifyTask(task, period),
      githubEvidence:evidence,
      githubErrors:results.flatMap((item) => item.error ? [{ url:item.link, message:item.error }] : []),
      analysis:analyzeTaskEvidence(task.status, evidence),
    };
  }));
  return { configured:true as const, period:{ ...period, label:formatWeekLabel(period) }, tasks };
}
