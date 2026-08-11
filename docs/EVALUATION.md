# Agent Evaluation

## 問題定義

Traceboard 的評測單位是一個可隔離執行的小型 Bug。每題包含 Agent 可見的 Issue 與 buggy source，以及 Agent 不可見的 executable acceptance test。

## 指標

- **Repair success rate**：候選修改通過 hidden evaluator 的比例。
- **Human intervention rate**：未修改、越界修改、runner 錯誤或驗收失敗而需要人工處理的比例。
- **Duration**：從建立暫存 workspace 到驗收完成的 wall-clock time。
- **Failure reason**：`no_change`、`scope_violation`、`hidden_tests_failed`、`agent_timeout` 或 runner error。

## 首輪結果

10 題單次執行有 7 題通過，表面成功率為 70%。人工檢查三個失敗候選後，發現 hidden evaluator 含有 Issue 未描述的要求：金額四捨五入順序、數字布林與空白處理，以及 token 遮罩後的文字大小寫。

這些失敗被重新分類為 **benchmark specification ambiguity**，而不是直接歸因於模型。補齊 acceptance criteria 並將安全案例改成語意驗證後，三題 selective rerun 全數通過。

## 正確解讀

不能宣稱「Agent 成功率已是 100%」。目前只有每題一次的樣本，且三題在人工看過候選後修改了規格。可信的結論是：

1. 評測 pipeline 能抓到表面合理但未符合驗收的修改。
2. Evaluation 同時暴露了需求品質問題。
3. 下一輪必須凍結 dataset version，每題至少重跑 3–5 次，才能比較模型或 prompt。

## 可重現命令

```bash
npm run benchmark:baseline
npm run benchmark -- --case B01
npm run benchmark -- --all
```

`benchmark:baseline` 驗證所有原始 fixture 都會失敗；它不是 Agent 修復成功率。真實結果保存在 `.benchmark-results/`，只有經人工檢查的摘要才放進 `benchmarks/results/`。
