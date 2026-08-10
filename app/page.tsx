"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "未開始" | "執行中" | "已完成";
type Tone = "neutral" | "review" | "success" | "risk";
type Evidence = { label: string; detail: string; tone: Tone; url?: string; conflict: boolean };
type Task = { title: string; project: string; status: Status; due: string; evidences: Evidence[]; conflict: boolean };
type ApiTask = {
  title:string; project:string; status:Status; due:string; githubLinks:string[];
  githubEvidence?:Array<{label:string;detail:string;tone:Tone;url:string;conflict:boolean}>;
  githubErrors?:Array<{url:string;message:string}>;
};

const filters = ["全部", "未開始", "執行中", "已完成"] as const;

function normalizeTask(task: ApiTask): Task {
  const validEvidence: Evidence[] = (task.githubEvidence || []).map((item) => ({ ...item }));
  const errors: Evidence[] = (task.githubErrors || []).map((item) => ({
    label: "GitHub 讀取失敗", detail: item.message, tone: "risk", url: item.url, conflict: false,
  }));
  const evidences = [...validEvidence, ...errors];
  if (!evidences.length) evidences.push({ label: "尚未連結", detail: "等待 Issue 或 PR", tone: "neutral", conflict: false });
  return { ...task, evidences, conflict: evidences.some((item) => item.conflict) };
}

export default function Home() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("全部");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [source, setSource] = useState<"notion" | "unconfigured" | "loading" | "error">("loading");
  const [syncedAt, setSyncedAt] = useState<string>("");

  const loadTasks = useCallback(async () => {
    setSource("loading");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json() as { configured?: boolean; tasks?: ApiTask[] };
      if (!response.ok) throw new Error("Notion query failed");
      if (!data.configured) {
        setTasks([]);
        setSource("unconfigured");
        return;
      }
      setTasks((data.tasks || []).map(normalizeTask));
      setSyncedAt(new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      setSource("notion");
    } catch {
      setTasks([]);
      setSource("error");
    }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const visibleTasks = useMemo(() => tasks.filter((task) => filter === "全部" || task.status === filter), [filter, tasks]);
  const conflicts = tasks.filter((task) => task.conflict);
  const firstConflictEvidence = conflicts[0]?.evidences.find((item) => item.conflict);
  const connectionText = source === "notion" ? "Notion 與 GitHub 已連線" : source === "loading" ? "正在讀取真實資料…" : source === "error" ? "資料讀取失敗" : "尚未設定 Notion";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Traceboard 首頁"><span className="brandMark">T</span><span>Traceboard</span></a>
        <div className={`connection ${source === "error" ? "connectionError" : ""}`}><span /> {connectionText}</div>
        <button className="avatar" aria-label="使用者選單">LC</button>
      </header>

      <section className="shell" id="top">
        <div className="hero">
          <div><p className="eyebrow">本週工作台 · 8/10—8/16</p><h1>工作進度，有證據才算數。</h1><p className="lede">彙整 Notion 任務與 GitHub 開發活動，快速找出進度、阻塞與狀態矛盾。</p></div>
          <button className="primary" onClick={() => void loadTasks()} disabled={source === "loading"}>{source === "loading" ? "同步中…" : "重新同步任務"}</button>
        </div>

        <section className="metrics" aria-label="本週統計">
          <article><span>本週任務</span><strong>{source === "loading" ? "—" : tasks.length}</strong><small>{new Set(tasks.map((task) => task.project)).size} 個專案</small></article>
          <article><span>執行中</span><strong>{source === "loading" ? "—" : tasks.filter((task) => task.status === "執行中").length}</strong><small className="blue">Notion 人工狀態</small></article>
          <article><span>已完成</span><strong>{source === "loading" ? "—" : tasks.filter((task) => task.status === "已完成").length}</strong><small className="green">Notion 人工狀態</small></article>
          <article className="riskMetric"><span>需要注意</span><strong>{source === "loading" ? "—" : conflicts.length}</strong><small className="red">Notion / GitHub 矛盾</small></article>
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
                <div className="githubEvidenceList">{task.evidences.map((item, index) => (
                  <div className="githubEvidence" key={`${item.url || item.label}-${index}`}>
                    <strong>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a> : item.label}</strong>
                    <small className={item.tone}>{item.detail}</small>
                  </div>
                ))}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="insight">
          <div className="agentIcon">A</div>
          <div><p className="eyebrow">規則建議</p><h2>{conflicts[0] ? `先確認「${conflicts[0].title}」的完成狀態` : "目前沒有明確的狀態矛盾"}</h2><p>{conflicts[0] && firstConflictEvidence ? `Notion 標示已完成，但 GitHub 顯示「${firstConflictEvidence.detail}」。請先確認再更新任務狀態。` : "GitHub 證據只代表工程活動；PR 合併後仍需確認部署、QA 或驗收。"}</p></div>
          {firstConflictEvidence?.url ? <a className="insightLink" href={firstConflictEvidence.url} target="_blank" rel="noreferrer">查看證據 →</a> : <span />}
        </section>
      </section>
    </main>
  );
}
