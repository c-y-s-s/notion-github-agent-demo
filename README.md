# Traceboard — Notion × GitHub Agent Demo

這是一個用來驗證「Notion 任務如何連結 GitHub 開發證據」的最小展示專案。目前使用假資料，下一階段才接 Notion 與 GitHub API。

## 目前包含

- 本週任務統計與狀態篩選
- Notion 狀態、GitHub PR 與 CI 證據並列
- 狀態矛盾提示與 Agent 建議
- 響應式 Dashboard

## 本機執行

需要 Node.js 22.13 或更新版本。

```bash
npm install
npm run dev
```

## 建議的 GitHub 測試流程

1. 將專案上傳到 GitHub。
2. 建立 Issue：`Connect Notion data source`。
3. 從新分支修改一筆 Demo Task，再開啟 Draft PR。
4. 將 Issue／PR URL 填入 Notion Task 的 `GitHub Links`。
5. 後續整合程式以這些明確 URL 取得證據，不從 Repository 活動猜測 Task。

## 下一階段

- Notion Integration 與 Data Source schema mapping
- GitHub Issue／PR URL parser
- 規則式 evidence analysis
- 固定格式週報
