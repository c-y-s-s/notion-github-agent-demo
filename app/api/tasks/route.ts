import { queryNotionTasks } from "../../../lib/notion";
import { getGithubEvidence } from "../../../lib/github";

export async function GET() {
  try {
    const result = await queryNotionTasks();
    if (!result.configured) return Response.json(result);
    const tasks = await Promise.all(result.tasks.map(async (task) => {
      const results = await Promise.all(task.githubLinks.map(async (link) => {
        try {
          return { link, evidence: await getGithubEvidence(link, task.status), error: null };
        } catch (error) {
          return { link, evidence: null, error: error instanceof Error ? error.message : "GitHub query failed" };
        }
      }));
      return {
        ...task,
        githubEvidence: results.flatMap((result) => result.evidence ? [result.evidence] : []),
        githubErrors: results.flatMap((result) => result.error ? [{ url: result.link, message: result.error }] : []),
      };
    }));
    return Response.json({ configured: true, tasks });
  } catch (error) {
    return Response.json(
      { configured: true, tasks: [], error: error instanceof Error ? error.message : "Notion query failed" },
      { status: 502 },
    );
  }
}
