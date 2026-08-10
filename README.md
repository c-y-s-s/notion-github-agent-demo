# Traceboard — Notion × GitHub Agent Demo

這是一個用來驗證「Notion 任務如何連結 GitHub 開發證據」的個人工作助理。介面只讀取真實 Notion 與 GitHub 資料，不顯示假資料。

## 目前包含

- 本週任務統計與狀態篩選
- Notion 狀態、GitHub PR 與 CI 證據並列
- 狀態矛盾提示與 Agent 建議
- 響應式 Dashboard
- 規則式建議狀態、信心程度與版本化判斷
- OpenAI Agent 對話與每日摘要
- Slack 每日摘要手動發送

## 本機執行

需要 Node.js 22.13 或更新版本。

```bash
npm install
npm run dev
```

複製 `.env.example` 為 `.env.local`，填入 `NOTION_TOKEN` 與 `NOTION_DATA_SOURCE_ID`。`.env.local` 已被 Git 忽略，請勿把 Token 提交到 GitHub。

## 建議的 GitHub 測試流程

1. 將專案上傳到 GitHub。
2. 建立 Issue：`Connect Notion data source`。
3. 從新分支修改一筆 Demo Task，再開啟 Draft PR。
4. 將 Issue／PR URL 填入 Notion Task 的 `GitHub Links`。
5. 後續整合程式以這些明確 URL 取得證據，不從 Repository 活動猜測 Task。

## 尚未完成

- 固定格式週報與匯出
- Task Evidence 詳細頁
- 連線狀態與錯誤分類介面
- Slack 去重與雲端排程
- 人工確認後寫回 Notion（非 MVP）
