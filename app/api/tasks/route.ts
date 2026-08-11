import { getTaskDataset } from "../../../lib/task-data";
import { backfillWorkItems, listWorkItems } from "../../../lib/work-items";

export async function GET() {
  try {
    const dataset = await getTaskDataset();
    if (!dataset.configured) return Response.json(dataset);
    let workItems:Awaited<ReturnType<typeof listWorkItems>> = [];
    try {
      await backfillWorkItems(dataset.tasks);
      workItems = await listWorkItems();
    } catch { /* tasks remain usable if D1 is unavailable */ }
    const byTaskId = new Map(workItems.map((item) => [item.notionTaskId, item]));
    return Response.json({ ...dataset, tasks:dataset.tasks.map((task) => ({ ...task, workItem:byTaskId.get(task.id) || null })) });
  }
  catch (error) {
    return Response.json({ configured:true, tasks:[], error:error instanceof Error ? error.message : "Task query failed" }, { status:502 });
  }
}
