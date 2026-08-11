# Traceboard 面試 Demo 腳本

## 一句話介紹（20 秒）

Traceboard 是 Coding Agent 的控制與評測層：它把 Notion 的產品任務和 GitHub 的工程證據整合成 Work Item，要求人工授權後才讓 Agent 在隔離環境修復，並保留工程完成與產品驗收兩種狀態。

## 展示順序（5 分鐘）

### 1. 問題與資料模型（45 秒）

打開 Dashboard，指出同一列同時包含 Notion 狀態、GitHub Issue／PR 證據及 Work Item 狀態。強調 PR number 與 Issue number 本來就不同，因此用 Work Item 關聯，而不是強迫名稱或編號相同。

### 2. 跨系統同步（45 秒）

按「匯入 Issue」預覽差異，確認後才寫入 Notion。說明同步不是盲目複製：GitHub 管工程證據，Notion 管產品工作與驗收。

### 3. Agent 分析與第一道授權（60 秒）

選擇一個小 Bug。Agent 先讀 Issue 與允許的 repository files，輸出根因、修改方向、驗證步驟、風險和阻塞因素。只有符合低風險條件才產生短效 approval token。

### 4. 隔離修改與第二道授權（75 秒）

確認修改方向後，runner 建立獨立 worktree、限制可修改檔案並執行測試。先展示 diff，不直接 push；使用者再次確認才建立 fix branch 與 PR。

### 5. 狀態閉環與評測（60 秒）

打開「Agent 評測」，展示固定基準測試與真實 Run 指標。PR merged 只推進 engineering status，產品仍需 acceptance status，避免把部署或 QA 尚未完成的任務誤判為完成。

## 面試官可能追問

### 為什麼不用 GitHub Copilot Coding Agent？

Traceboard 不重新實作模型本身。差異在跨系統 identity、兩階段人工授權、產品／工程狀態分離，以及針對每次 Agent Run 的可觀測性與評測。

### 為什麼需要 Work Item？

Issue #21 和 PR #23 是不同 GitHub 物件，Notion 標題也可能被修改。Work Item 保存穩定對應與狀態，不用依賴名稱相等。

### 如何避免 Agent 亂改？

分析階段唯讀；GitHub 內容視為不可信資料；只有允許清單內的檔案能被修改；修改在隔離 worktree；方向和 diff 分兩次人工確認；最終 merge 仍由人完成。

### 評測可信嗎？

固定案例只能證明狀態規則沒有回歸；真實 Run 指標只能反映目前收集的任務。兩者會分開呈現，不把單元測試通過率包裝成 Agent 修復成功率。

## 現場失敗備案

- OpenAI API 不可用：展示既有 Agent Run 與結構化輸出，不假裝即時執行成功。
- GitHub rate limit／Token 權限錯誤：展示錯誤分類與安全停止，不臨時擴大 Token 權限。
- Notion API 不可用：用架構圖與 Work Item API 說明資料模型，但明確標示不是即時資料。
- 修復測試失敗：這也是有效 Demo；展示 runner 如何停止在 push 之前並留下 failure code。

## Demo 前檢查

```bash
npm run lint
npm test
```

- 準備一個只需修改 1–2 個檔案、有明確重現步驟的 Bug Issue。
- 確認 `.env.local` 沒有被 Git 追蹤。
- 確認 GitHub Token 只提供 Demo 所需 repository 權限。
- 預先載入 Dashboard，但不要用假資料掩蓋外部服務失敗。
