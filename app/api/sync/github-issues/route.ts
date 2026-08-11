import { alignExistingGithubIssuesInNotion, getGithubIssueSyncPlan, syncGithubIssuesToNotion } from "../../../../lib/github-sync";
import { getTaskDataset } from "../../../../lib/task-data";
import { backfillWorkItems, tryWorkItem } from "../../../../lib/work-items";

export async function GET() {
  try { return Response.json(await getGithubIssueSyncPlan()); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Sync preview failed" }, { status:502 }); }
}

export async function PATCH() {
  try { return Response.json(await alignExistingGithubIssuesInNotion()); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Alignment failed" }, { status:502 }); }
}

export async function POST(request:Request) {
  try {
    const body = await request.json() as { issueNumbers?:unknown };
    if (!Array.isArray(body.issueNumbers) || !body.issueNumbers.every((value) => Number.isInteger(value) && value > 0)) return Response.json({ error:"invalid_issue_numbers" }, { status:400 });
    const result = await syncGithubIssuesToNotion(body.issueNumbers as number[]);
    await tryWorkItem(async () => {
      const dataset = await getTaskDataset();
      if (dataset.configured) await backfillWorkItems(dataset.tasks);
    });
    return Response.json(result);
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Sync failed" }, { status:502 }); }
}
