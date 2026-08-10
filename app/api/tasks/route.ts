import { getTaskDataset } from "../../../lib/task-data";

export async function GET() {
  try { return Response.json(await getTaskDataset()); }
  catch (error) {
    return Response.json({ configured:true, tasks:[], error:error instanceof Error ? error.message : "Task query failed" }, { status:502 });
  }
}
