import { queryNotionTasks } from "../../../lib/notion";
import { getGithubEvidence } from "../../../lib/github";
import { classifyTask, formatWeekLabel, getWeekPeriod } from "../../../lib/date";
import { analyzeTaskEvidence } from "../../../lib/rules";

export async function GET() {
  try {
    const result = await queryNotionTasks();
    if (!result.configured) return Response.json(result);
    const period = getWeekPeriod();
    const tasks = await Promise.all(result.tasks.map(async (task) => {
      const results = await Promise.all(task.githubLinks.map(async (link) => {
        try {
          return { link, evidence: await getGithubEvidence(link, task.status), error: null };
        } catch (error) {
          return { link, evidence: null, error: error instanceof Error ? error.message : "GitHub query failed" };
        }
      }));
      const evidence = results.flatMap((result) => result.evidence ? [result.evidence] : []);
      return {
        ...task,
        computedTags: classifyTask(task, period),
        githubEvidence: evidence,
        githubErrors: results.flatMap((result) => result.error ? [{ url: result.link, message: result.error }] : []),
        analysis: analyzeTaskEvidence(task.status, evidence),
      };
    }));
    return Response.json({ configured: true, period: { ...period, label: formatWeekLabel(period) }, tasks });
  } catch (error) {
    return Response.json(
      { configured: true, tasks: [], error: error instanceof Error ? error.message : "Notion query failed" },
      { status: 502 },
    );
  }
}
