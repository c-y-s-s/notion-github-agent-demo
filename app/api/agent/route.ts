import { agentTools, runAgentTool } from "../../../lib/agent";
import { getTaskDataset } from "../../../lib/task-data";

type OpenAIOutput = { type:string; name?:string; arguments?:string; call_id?:string; content?:Array<{type:string;text?:string}> };

export async function POST(request:Request) {
  try {
    const { message } = await request.json() as { message?:string };
    if (!message?.trim() || message.length > 1000) return Response.json({ error:"invalid_message" }, { status:400 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error:"openai_not_configured" }, { status:503 });
    const dataset = await getTaskDataset();
    const toolsUsed:string[] = [];
    let input:unknown[] = [{ role:"user", content:message.trim() }];
    let responseData:{ output?:OpenAIOutput[] } = {};

    for (let turn=0; turn<3; turn++) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" },
        body:JSON.stringify({
          model:process.env.OPENAI_MODEL || "gpt-5.6-luna",
          store:false,
          reasoning:{ effort:"low" },
          instructions:"你是 Traceboard 專案進度 Agent。涉及任務、日期、數量、GitHub 或風險時必須使用工具。不得根據記憶虛構 Task。數字只能引用工具結果。使用者問『本週有哪些 Task』時，必須使用 query_tasks(scope=this_week)，不得把全部 Task 當成本週。要求每日工作摘要時必須使用 generate_daily_brief，先列今天概況，再列最多三項優先行動與原因；沒有異常時明確說明，不得硬湊建議。回答使用繁體中文、簡潔清楚；指出資料不足。每個具體 Task 盡可能附 notion_url 或 GitHub evidence URL。PR merged 只能說可能完成，不能等同部署、QA 或業務驗收完成。你沒有寫入權限。",
          tools:agentTools,
          tool_choice:"auto",
          input,
          max_output_tokens:900,
        }),
      });
      responseData = await response.json() as typeof responseData & { error?:{message?:string} };
      if (!response.ok) throw new Error(responseData.error?.message || `OpenAI HTTP ${response.status}`);
      const calls = (responseData.output || []).filter((item) => item.type === "function_call");
      if (!calls.length) break;
      const outputs = await Promise.all(calls.map(async (call) => {
        const name = call.name as Parameters<typeof runAgentTool>[0];
        toolsUsed.push(name);
        let args:{project:string|null;scope?:string} = { project:null };
        try { args = JSON.parse(call.arguments || "{}"); } catch { /* strict tools should prevent this */ }
        const result = await runAgentTool(name, args, dataset);
        return { type:"function_call_output", call_id:call.call_id, output:JSON.stringify(result) };
      }));
      input = [...input, ...(responseData.output || []), ...outputs];
    }

    const answer = (responseData.output || []).flatMap((item) => item.type === "message" ? item.content || [] : []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("\n").trim();
    if (!answer) throw new Error("Agent returned no answer");
    return Response.json({ answer, tools_used:[...new Set(toolsUsed)] });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Agent failed" }, { status:502 });
  }
}
