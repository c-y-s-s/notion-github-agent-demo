import { queryNotionTasks } from "../../../lib/notion";
import { getGithubEvidence } from "../../../lib/github";

export async function GET() {
  try {
    const result = await queryNotionTasks();
    if (!result.configured) return Response.json(result);
    const tasks = await Promise.all(result.tasks.map(async (task) => {
      const link = task.githubLinks[0];
      if (!link) return { ...task, githubEvidence: null, githubError: null };
      try {
        return { ...task, githubEvidence: await getGithubEvidence(link, task.status), githubError: null };
      } catch (error) {
        return { ...task, githubEvidence: null, githubError: error instanceof Error ? error.message : "GitHub query failed" };
      }
    }));
    return Response.json({ configured: true, tasks });
  } catch (error) {
    return Response.json(
      { configured: true, tasks: [], error: error instanceof Error ? error.message : "Notion query failed" },
      { status: 502 },
    );
  }
}
