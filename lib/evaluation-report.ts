type RepairCase = { id:string;category:string;title:string;issue:string };
type InitialResult = {
  generatedAt:string;
  environment:{codexCli:string;node:string;sourceCommit:string;runsPerCase:number};
  metrics:{total:number;repaired:number;repairSuccessRate:number;humanInterventionRate:number;averageDurationMs:number};
  failedCases:string[];
  review:{classification:string;finding:string};
};

export function buildEvaluationReport(initial:InitialResult, cases:RepairCase[]) {
  const rows = cases.map((item) => `| ${item.id} | ${item.category} | ${item.title} | ${initial.failedCases.includes(item.id) ? "首輪失敗" : "首輪通過"} |`).join("\n");
  return `# Traceboard Agent Repair Evaluation\n\n` +
    `生成時間：${initial.generatedAt}\n\n` +
    `## 摘要\n\n` +
    `- 案例：${initial.metrics.total}\n` +
    `- 首輪修復成功：${initial.metrics.repaired}/${initial.metrics.total}（${Math.round(initial.metrics.repairSuccessRate * 100)}%）\n` +
    `- 人工介入率：${Math.round(initial.metrics.humanInterventionRate * 100)}%\n` +
    `- 平均耗時：${(initial.metrics.averageDurationMs / 1000).toFixed(1)} 秒\n\n` +
    `## 案例結果\n\n| ID | 類型 | 案例 | 結果 |\n|---|---|---|---|\n${rows}\n\n` +
    `## 失敗分析\n\n首輪失敗：${initial.failedCases.join("、")}。人工審查分類為 \`${initial.review.classification}\`。${initial.review.finding}\n\n` +
    `修訂驗收規格後，只針對三個失敗案例重跑並全數通過。這是選擇性診斷，不能解讀為完整 10 題成功率 100%。\n\n` +
    `## 方法\n\nAgent 只能讀取 Issue 與單一 buggy source；hidden evaluator 不會放入 Agent workspace。每題使用乾淨暫存目錄，並檢查未修改、越界修改、timeout 與 hidden test。\n\n` +
    `## 限制\n\n每題只有一次首輪樣本，尚不足以比較模型穩定性。下一版應凍結 dataset，對每題重跑 3–5 次，並記錄模型版本與 prompt 版本。\n\n` +
    `## 執行環境\n\n- Codex CLI：${initial.environment.codexCli}\n- Node.js：${initial.environment.node}\n- Source commit：${initial.environment.sourceCommit}\n- 每題首輪次數：${initial.environment.runsPerCase}\n`;
}
