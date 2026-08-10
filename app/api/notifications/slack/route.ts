import { sendSlackDailyBrief } from "../../../../lib/slack";

export async function GET() {
  return Response.json({ configured:Boolean(process.env.SLACK_WEBHOOK_URL), schedule:"09:45 Asia/Taipei", automatic:false });
}

export async function POST() {
  try {
    const result = await sendSlackDailyBrief();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack failed";
    return Response.json({ error:message }, { status:message === "slack_not_configured" ? 503 : 502 });
  }
}
