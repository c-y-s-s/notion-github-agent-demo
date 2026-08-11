import { getTaskDataset } from "../../../lib/task-data";
import { backfillWorkItems, listWorkItems } from "../../../lib/work-items";

export async function GET() {
  try { return Response.json({ workItems:await listWorkItems() }); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Work Items unavailable" }, { status:503 }); }
}

export async function POST() {
  try {
    const dataset = await getTaskDataset();
    if (!dataset.configured) return Response.json({ error:"notion_not_configured" }, { status:503 });
    const ids = await backfillWorkItems(dataset.tasks);
    return Response.json({ upserted:ids.length, workItems:await listWorkItems() });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Work Item backfill failed" }, { status:502 }); }
}
