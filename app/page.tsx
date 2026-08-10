"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Task = {
  title: string;
  project: string;
  status: "未開始" | "執行中" | "已完成";
  due: string;
  github: string;
  evidence: string;
  tone: "neutral" | "review" | "success" | "risk";
  evidenceUrl?: string;
  conflict?: boolean;
};

const demoTasks: Task[] = [
  {
    title: "建立登入頁面",
    project: "會員系統",
    status: "未開始",
    due: "8 月 12 日",
    github: "尚未連結",
    evidence: "等待 Issue 或 PR",
    tone: "neutral",
  },
  {
    title: "串接登入 API",
    project: "會員系統",
    status: "執行中",
    due: "8 月 14 日",
    github: "PR #18",
    evidence: "等待 Review · 2 天",
    tone: "review",
  },
  {
    title: "修正登入錯誤提示",
    project: "會員系統",
    status: "已完成",
    due: "8 月 10 日",
    github: "PR #16",
    evidence: "已合併 · Checks passed",
    tone: "success",
  },
  {
    title: "匯出報表",
    project: "後台系統",
    status: "已完成",
    due: "8 月 9 日",
    github: "PR #42",
    evidence: "狀態矛盾 · CI failed",
    tone: "risk",
  },
];

const filters = ["全部", "未開始", "執行中", "已完成"] as const;

export default function Home() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("全部");
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [source, setSource] = useState<"demo" | "notion" | "loading" | "error">("loading");

  const loadTasks = useCallback(async () => {
    setSource("loading");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json() as { configured?: boolean; tasks?: Array<{ title:string; project:string; status:Task["status"]; due:string; githubLinks:string[]; githubEvidence?:{label:string;detail:string;tone:Task["tone"];url:string;conflict:boolean}|null; githubError?:string|null }> };
      if (!response.ok) throw new Error("Notion query failed");
      if (!data.configured) {
        setTasks(demoTasks);
        setSource("demo");
        return;
      }
      setTasks((data.tasks || []).map((task) => {
        const evidence = task.githubEvidence;
        return { ...task, github: evidence?.label || (task.githubLinks[0] ? "GitHub 讀取失敗" : "尚未連結"), evidence: evidence?.detail || task.githubError || "等待 Issue 或 PR", tone: evidence?.tone || (task.githubError ? "risk" : "neutral"), evidenceUrl: evidence?.url, conflict: evidence?.conflict || false };
      }));
      setSource("notion");
    } catch {
      setTasks(demoTasks);
      setSource("error");
    }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === "全部" || task.status === filter),
    [filter],
  );
  const conflicts = tasks.filter((task) => task.conflict);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Traceboard 首頁">
          <span className="brandMark">T</span>
          <span>Traceboard</span>
        </a>
        <div className={`connection ${source === "error" ? "connectionError" : ""}`}><span /> {source === "notion" ? "Notion 已連線 · GitHub 待接入" : source === "loading" ? "正在讀取 Notion…" : source === "error" ? "Notion 連線失敗 · 顯示 Demo" : "尚未設定 Notion · 顯示 Demo"}</div>
        <button className="avatar" aria-label="使用者選單">LC</button>
      </header>

      <section className="shell" id="top">
        <div className="hero">
          <div>
            <p className="eyebrow">本週工作台 · 8/10—8/16</p>
            <h1>工作進度，有證據才算數。</h1>
            <p className="lede">彙整 Notion 任務與 GitHub 開發活動，快速找出進度、阻塞與狀態矛盾。</p>
          </div>
          <button className="primary" onClick={() => void loadTasks()} disabled={source === "loading"}>{source === "loading" ? "同步中…" : "重新同步任務"}</button>
        </div>

        <section className="metrics" aria-label="本週統計">
          <article><span>本週任務</span><strong>{tasks.length}</strong><small>{new Set(tasks.map((task) => task.project)).size} 個專案</small></article>
          <article><span>執行中</span><strong>{tasks.filter((task) => task.status === "執行中").length}</strong><small className="blue">等待 GitHub 證據</small></article>
          <article><span>已完成</span><strong>{tasks.filter((task) => task.status === "已完成").length}</strong><small className="green">Notion 人工狀態</small></article>
          <article className="riskMetric"><span>需要注意</span><strong>{conflicts.length}</strong><small className="red">Notion / GitHub 矛盾</small></article>
        </section>

        <section className="workspace">
          <div className="sectionHead">
            <div><h2>任務證據</h2><p>最後同步：今天 10:42</p></div>
            <div className="filters" aria-label="任務狀態篩選">
              {filters.map((item) => (
                <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className="taskTable">
            <div className="tableRow tableHeader"><span>任務</span><span>狀態</span><span>到期日</span><span>GitHub 證據</span></div>
            {visibleTasks.map((task) => (
              <article className="tableRow" key={task.title}>
                <div className="taskName"><strong>{task.title}</strong><small>{task.project}</small></div>
                <div><span className={`status status-${task.status}`}>{task.status}</span></div>
                <span>{task.due}</span>
                <div className="githubEvidence"><strong>{task.evidenceUrl ? <a href={task.evidenceUrl} target="_blank" rel="noreferrer">{task.github} ↗</a> : task.github}</strong><small className={task.tone}>{task.evidence}</small></div>
              </article>
            ))}
          </div>
        </section>

        <section className="insight">
          <div className="agentIcon">A</div>
          <div><p className="eyebrow">規則建議</p><h2>{conflicts[0] ? `先確認「${conflicts[0].title}」的完成狀態` : "目前沒有明確的狀態矛盾"}</h2><p>{conflicts[0] ? `Notion 標示已完成，但 GitHub 顯示「${conflicts[0].evidence}」。請先確認再更新任務狀態。` : "GitHub 證據只代表工程活動；PR 合併後仍需確認部署、QA 或驗收。"}</p></div>
          {conflicts[0]?.evidenceUrl ? <a className="insightLink" href={conflicts[0].evidenceUrl} target="_blank" rel="noreferrer">查看證據 →</a> : <span />}
        </section>
      </section>
    </main>
  );
}
