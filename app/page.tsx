"use client";

import { useMemo, useState } from "react";

type Task = {
  title: string;
  project: string;
  status: "未開始" | "執行中" | "已完成";
  due: string;
  github: string;
  evidence: string;
  tone: "neutral" | "review" | "success" | "risk";
};

const tasks: Task[] = [
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
  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === "全部" || task.status === filter),
    [filter],
  );

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Traceboard 首頁">
          <span className="brandMark">T</span>
          <span>Traceboard</span>
        </a>
        <div className="connection"><span /> Notion 已連線 · GitHub 已連線</div>
        <button className="avatar" aria-label="使用者選單">LC</button>
      </header>

      <section className="shell" id="top">
        <div className="hero">
          <div>
            <p className="eyebrow">本週工作台 · 8/10—8/16</p>
            <h1>工作進度，有證據才算數。</h1>
            <p className="lede">彙整 Notion 任務與 GitHub 開發活動，快速找出進度、阻塞與狀態矛盾。</p>
          </div>
          <button className="primary">重新同步證據</button>
        </div>

        <section className="metrics" aria-label="本週統計">
          <article><span>本週任務</span><strong>4</strong><small>2 個專案</small></article>
          <article><span>執行中</span><strong>1</strong><small className="blue">1 筆等待 Review</small></article>
          <article><span>已完成</span><strong>2</strong><small className="green">50% 完成率</small></article>
          <article className="riskMetric"><span>需要注意</span><strong>1</strong><small className="red">Notion / GitHub 矛盾</small></article>
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
                <div className="githubEvidence"><strong>{task.github}</strong><small className={task.tone}>{task.evidence}</small></div>
              </article>
            ))}
          </div>
        </section>

        <section className="insight">
          <div className="agentIcon">A</div>
          <div><p className="eyebrow">AGENT 建議</p><h2>先確認「匯出報表」的完成狀態</h2><p>Notion 標示已完成，但 PR #42 的 CI 尚未通過。建議確認是否有其他部署證據，再更新任務狀態。</p></div>
          <button>查看證據 →</button>
        </section>
      </section>
    </main>
  );
}
