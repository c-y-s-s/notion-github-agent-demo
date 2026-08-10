"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";

type Status = "未開始" | "執行中" | "已完成";
type Tone = "neutral" | "review" | "success" | "risk";
type ComputedTag = "due_this_week" | "completed_this_week" | "overdue" | "no_due";
type Evidence = { label: string; detail: string; tone: Tone; url?: string; conflict: boolean };
type Analysis = { code:string; severity:"none"|"info"|"warning"|"conflict"; summary:string; suggestedStatus:Status|null; confidence:number; ruleVersion:string };
type Task = { title: string; project: string; status: Status; due: string; computedTags:ComputedTag[]; evidences: Evidence[]; analysis:Analysis; conflict: boolean };
type ApiTask = {
  title:string; project:string; status:Status; due:string; githubLinks:string[]; computedTags:ComputedTag[];
  githubEvidence?:Array<{label:string;detail:string;tone:Tone;url:string;conflict:boolean}>;
  githubErrors?:Array<{url:string;message:string}>;
  analysis:Analysis;
};
type ChatMessage = { role:"user"|"agent"; text:string; tools?:string[] };
type SyncIssue = { number:number; title:string; url:string; workType:string };

const filters = ["全部", "本週", "逾期", "無期限", "未開始", "執行中", "已完成"] as const;

function AgentMarkdown({ children }:{ children:string }) {
  return <div className="agentMarkdown"><Markdown components={{ a:({ href, children:linkText }) => <a href={href} target="_blank" rel="noreferrer">{linkText}</a> }}>{children}</Markdown></div>;
}

function normalizeTask(task: ApiTask): Task {
  const validEvidence: Evidence[] = (task.githubEvidence || []).map((item) => ({ ...item }));
  const errors: Evidence[] = (task.githubErrors || []).map((item) => ({
    label: "GitHub 讀取失敗", detail: item.message, tone: "risk", url: item.url, conflict: false,
  }));
  const evidences = [...validEvidence, ...errors];
  if (!evidences.length) evidences.push({ label: "尚未連結", detail: "等待 Issue 或 PR", tone: "neutral", conflict: false });
  return { ...task, evidences, conflict: task.analysis.severity === "conflict" };
}

export default function Home() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("全部");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [source, setSource] = useState<"notion" | "unconfigured" | "loading" | "error">("loading");
  const [syncedAt, setSyncedAt] = useState<string>("");
  const [weekLabel, setWeekLabel] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dailySummary, setDailySummary] = useState("");
  const [dailyLoading, setDailyLoading] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackResult, setSlackResult] = useState("");
  const [syncIssues, setSyncIssues] = useState<SyncIssue[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState("");

  const loadTasks = useCallback(async () => {
    setSource("loading");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json() as { configured?: boolean; tasks?: ApiTask[]; period?:{label:string} };
      if (!response.ok) throw new Error("Notion query failed");
      if (!data.configured) {
        setTasks([]);
        setSource("unconfigured");
        return;
      }
      setTasks((data.tasks || []).map(normalizeTask));
      setWeekLabel(data.period?.label || "");
      setSyncedAt(new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      setSource("notion");
    } catch {
      setTasks([]);
      setSource("error");
    }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === "全部") return true;
    if (filter === "本週") return task.computedTags.includes("due_this_week") || task.computedTags.includes("completed_this_week");
    if (filter === "逾期") return task.computedTags.includes("overdue");
    if (filter === "無期限") return task.computedTags.includes("no_due");
    return task.status === filter;
  }), [filter, tasks]);
  const conflicts = tasks.filter((task) => task.conflict);
  const attention = tasks.filter((task) => task.analysis.severity === "warning" || task.analysis.severity === "conflict");
  const dueThisWeek = tasks.filter((task) => task.computedTags.includes("due_this_week"));
  const completedThisWeek = tasks.filter((task) => task.computedTags.includes("completed_this_week"));
  const overdue = tasks.filter((task) => task.computedTags.includes("overdue"));
  const firstConflictEvidence = conflicts[0]?.evidences.find((item) => item.conflict);
  const connectionText = source === "notion" ? "Notion 與 GitHub 已連線" : source === "loading" ? "正在讀取真實資料…" : source === "error" ? "資料讀取失敗" : "尚未設定 Notion";

  async function askAgent(event:FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || chatLoading) return;
    setMessages((current) => [...current, { role:"user", text:value }]);
    setQuestion("");
    setChatLoading(true);
    try {
      const response = await fetch("/api/agent", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ message:value }) });
      const data = await response.json() as { answer?:string; tools_used?:string[]; error?:string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Agent failed");
      setMessages((current) => [...current, { role:"agent", text:data.answer!, tools:data.tools_used || [] }]);
    } catch (error) {
      setMessages((current) => [...current, { role:"agent", text:`目前無法回答：${error instanceof Error ? error.message : "unknown_error"}` }]);
    } finally { setChatLoading(false); }
  }

  async function generateDailySummary() {
    if (dailyLoading) return;
    setDailyLoading(true);
    try {
      const response = await fetch("/api/agent", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ message:"產生今天的每日工作摘要，列出概況與最多三項優先行動，並說明原因。" }) });
      const data = await response.json() as { answer?:string; error?:string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Agent failed");
      setDailySummary(data.answer);
    } catch (error) {
      setDailySummary(`目前無法產生摘要：${error instanceof Error ? error.message : "unknown_error"}`);
    } finally { setDailyLoading(false); }
  }

  async function sendToSlack() {
    if (slackLoading) return;
    setSlackLoading(true);
    setSlackResult("");
    try {
      const response = await fetch("/api/notifications/slack", { method:"POST" });
      const data = await response.json() as { sent?:boolean; error?:string };
      if (!response.ok || !data.sent) throw new Error(data.error || "Slack failed");
      setSlackResult("已發送到 Slack");
    } catch (error) {
      setSlackResult(error instanceof Error && error.message === "slack_not_configured" ? "尚未設定 Slack Webhook" : `發送失敗：${error instanceof Error ? error.message : "unknown_error"}`);
    } finally { setSlackLoading(false); }
  }

  async function previewGithubSync() {
    setSyncLoading(true); setSyncResult("");
    try {
      const response = await fetch("/api/sync/github-issues", { cache:"no-store" });
      const data = await response.json() as { missing?:SyncIssue[]; error?:string };
      if (!response.ok) throw new Error(data.error || "Preview failed");
      setSyncIssues(data.missing || []);
      setSyncResult(data.missing?.length ? "請確認以下項目，再匯入 Notion。" : "GitHub 與 Notion 已同步，沒有缺少的 Issue。");
    } catch (error) { setSyncResult(`讀取失敗：${error instanceof Error ? error.message : "unknown_error"}`); }
    finally { setSyncLoading(false); }
  }

  async function confirmGithubSync() {
    if (!syncIssues.length) return;
    setSyncLoading(true); setSyncResult("");
    try {
      const response = await fetch("/api/sync/github-issues", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ issueNumbers:syncIssues.map((issue) => issue.number) }) });
      const data = await response.json() as { created?:unknown[]; error?:string };
      if (!response.ok) throw new Error(data.error || "Sync failed");
      setSyncIssues([]); setSyncResult(`已建立 ${data.created?.length || 0} 筆 Notion Tasks。`);
      await loadTasks();
    } catch (error) { setSyncResult(`同步失敗：${error instanceof Error ? error.message : "unknown_error"}`); }
    finally { setSyncLoading(false); }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Traceboard 首頁">Traceboard</a>
        <div className={`connection ${source === "error" ? "connectionError" : ""}`}><span /> {connectionText}</div>
      </header>

      <section className="shell" id="top">
        <div className="pageHeader">
          <div><h1>工作進度</h1><p>{weekLabel ? `本週 · ${weekLabel}` : "正在取得本週範圍"}</p></div>
          <button className="primary" onClick={() => void loadTasks()} disabled={source === "loading"}>{source === "loading" ? "同步中…" : "重新同步"}</button>
        </div>

        <section className="summaryBar" aria-label="本週統計">
          <article><span>本週預計</span><strong>{source === "loading" ? "—" : dueThisWeek.length}</strong><small>{new Set(dueThisWeek.map((task) => task.project)).size} 個專案</small></article>
          <article><span>本週完成</span><strong>{source === "loading" ? "—" : completedThisWeek.length}</strong><small className="green">依 Completed At</small></article>
          <article><span>已逾期</span><strong>{source === "loading" ? "—" : overdue.length}</strong><small className="red">截止日已過且未完成</small></article>
          <article className="riskMetric"><span>需要確認</span><strong>{source === "loading" ? "—" : attention.length}</strong><small className="red">建議或狀態矛盾</small></article>
        </section>

        <section className="dailyBrief" aria-labelledby="daily-brief-title">
          <div className="dailyBriefHead">
            <div><h2 id="daily-brief-title">每日工作摘要</h2><p>依逾期、今天到期與狀態矛盾整理，不會修改 Notion。</p></div>
            <div className="dailyActions">
              <button onClick={() => void generateDailySummary()} disabled={dailyLoading || source !== "notion"}>{dailyLoading ? "整理中…" : dailySummary ? "重新產生" : "產生今日摘要"}</button>
              <button className="slackButton" onClick={() => void sendToSlack()} disabled={slackLoading || source !== "notion"}>{slackLoading ? "發送中…" : "立即發送 Slack"}</button>
            </div>
          </div>
          {slackResult && <p className={`slackResult ${slackResult.startsWith("已") ? "success" : "error"}`}>{slackResult}</p>}
          {dailySummary ? <div className="dailyBriefContent"><AgentMarkdown>{dailySummary}</AgentMarkdown></div> : <p className="dailyBriefEmpty">產生後會顯示今日概況，以及最多三項需要優先處理的工作。</p>}
        </section>

        <section className="syncPanel" aria-labelledby="sync-title">
          <div className="syncHead">
            <div><h2 id="sync-title">GitHub Issues → Notion</h2><p>只建立 Notion 尚未收錄的開啟中 Issue，不覆蓋既有 Task。</p></div>
            <button onClick={() => void previewGithubSync()} disabled={syncLoading}>{syncLoading ? "讀取中…" : "檢查待同步 Issue"}</button>
          </div>
          {!!syncIssues.length && <div className="syncPreview">
            {syncIssues.map((issue) => <div key={issue.number}><span>#{issue.number} · {issue.title}</span><small>{issue.workType}</small></div>)}
            <button onClick={() => void confirmGithubSync()} disabled={syncLoading}>確認匯入 {syncIssues.length} 筆</button>
          </div>}
          {syncResult && <p className="syncResult">{syncResult}</p>}
        </section>

        <section className="workspace">
          <div className="sectionHead">
            <div><h2>任務證據</h2><p>{syncedAt ? `最後同步：今天 ${syncedAt}` : "尚未完成同步"}</p></div>
            <div className="filters" aria-label="任務狀態篩選">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
          </div>

          <div className="taskTable">
            <div className="tableRow tableHeader"><span>任務</span><span>狀態</span><span>到期日</span><span>GitHub 證據</span></div>
            {source === "loading" && <div className="dataState">正在同步 Notion 與 GitHub，畫面不會顯示假資料。</div>}
            {source === "error" && <div className="dataState errorState">讀取失敗。請檢查連線後重新同步。</div>}
            {source === "unconfigured" && <div className="dataState">尚未設定 Notion，請先完成本機環境變數。</div>}
            {source === "notion" && !visibleTasks.length && <div className="dataState">沒有符合目前篩選條件的 Task。</div>}
            {visibleTasks.map((task) => (
              <article className="tableRow" key={task.title}>
                <div className="taskName"><strong>{task.title}</strong><small>{task.project}</small></div>
                <div><span className={`status status-${task.status}`}>{task.status}</span></div>
                <span>{task.due}</span>
                <div className="githubEvidenceList">
                  {task.evidences.map((item, index) => (
                    <div className="githubEvidence" key={`${item.url || item.label}-${index}`}>
                      <strong>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a> : item.label}</strong>
                      <small className={item.tone}>{item.detail}</small>
                    </div>
                  ))}
                  <div className={`analysisResult analysis-${task.analysis.severity}`}>
                    <span>{task.analysis.suggestedStatus ? `建議 ${task.analysis.suggestedStatus}` : task.analysis.code === "consistent" ? "狀態一致" : "證據不足"}</span>
                    <strong>{Math.round(task.analysis.confidence * 100)}%</strong>
                    <small>{task.analysis.summary}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ruleNotice">
          <div><strong>需要確認</strong><h2>{attention[0] ? `「${attention[0].title}」` : "目前沒有需要人工確認的項目"}</h2><p>{attention[0]?.analysis.summary || "GitHub 證據只代表工程活動；PR 合併後仍需確認部署、QA 或驗收。"}</p></div>
          {(attention[0]?.evidences[0]?.url || firstConflictEvidence?.url) ? <a href={attention[0]?.evidences[0]?.url || firstConflictEvidence?.url} target="_blank" rel="noreferrer">查看證據 →</a> : <span />}
        </section>

        <section className="agentPanel" aria-labelledby="agent-title">
          <div className="agentHeader">
            <div><h2 id="agent-title">詢問 Agent</h2><p>從 Notion 與 GitHub 查詢任務、逾期項目與狀態矛盾。</p></div>
            <span className="readOnlyBadge">唯讀模式</span>
          </div>
          {!messages.length && <div className="suggestions">
            {["我這週有哪些 Task？","哪些工作已經逾期？","哪些狀態需要人工確認？","幫我整理本週工作摘要"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}
          </div>}
          {!!messages.length && <div className="conversation" aria-live="polite">
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
              <strong>{message.role === "agent" ? "Agent" : "你"}</strong>
              <AgentMarkdown>{message.text}</AgentMarkdown>
              {!!message.tools?.length && <small>使用工具：{message.tools.join("、")}</small>}
            </div>)}
            {chatLoading && <div className="message agent"><strong>Agent</strong><p>正在查詢任務與證據…</p></div>}
          </div>}
          <form className="agentForm" onSubmit={askAgent}>
            <label className="srOnly" htmlFor="agent-question">詢問 Agent</label>
            <input id="agent-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="例如：這週有哪些工作可能延遲？" />
            <button disabled={!question.trim() || chatLoading}>{chatLoading ? "查詢中" : "詢問 Agent"}</button>
          </form>
          <p className="agentNote">任務內容會傳送至 OpenAI API 以產生回答；Token 不會送入模型。</p>
        </section>
      </section>
    </main>
  );
}
