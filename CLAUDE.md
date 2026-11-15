# CLAUDE.md — Reset66

個人自用的 66 天習慣養成 PWA。完整規格與里程碑見 `PROJECT_PLAN.md`,開工前先讀完。

## 溝通
- 使用者是 Gerald,以**繁體中文**溝通。
- 偏好**完整、可直接複製使用的程式碼**,不要零碎片段。
- 技術說明直接講深度,不需要過度鋪陳。
- 程式碼註解與 commit message 用英文;給使用者看的 UI 文字用繁體中文。

## 技術約束
- Vanilla JavaScript(ES Modules),**無建置步驟**。未經使用者同意不得引入 bundler 或框架。
- 依賴越少越好。僅允許 `vitest` 作為開發依賴。
- 儲存只用 `localStorage`(key:`reset66.v1`),狀態結構見 `PROJECT_PLAN.md` §4。
- **衍生資料(XP、等級、streak、Day X)不得存檔**,一律由 `logs` 即時計算。
- `src/logic/` 內只能是純函式:不碰 DOM、不碰 `localStorage`、不呼叫 `Date.now()`(需要「現在」時由參數傳入)。
- 日期一律是本地時區 `YYYY-MM-DD` 字串;一天的邊界由 `program.dayBoundaryHour` 決定。

## 指令
```bash
npm test                 # 跑 Vitest
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Root . -Port 8000   # 本機預覽(無需額外依賴)
```
> Claude 桌面版可直接用 `.claude/launch.json` 的 `reset66` 設定啟動預覽。
> Service Worker 只在 HTTPS 或 localhost 運作。手機實機測試請用部署網址或 HTTPS 隧道,不要用區網 http。

## 工作方式
1. 一次做一個里程碑(M0 → M5),每個里程碑結束時對照 `PROJECT_PLAN.md` 的驗收標準逐項確認。
2. **先寫邏輯測試,再寫 UI**。M1 沒全綠不要進 M2。
3. 改動 `sw.js` 快取內容時,必須同步更新快取版本號。
4. 修改資料結構時,必須提升 `schemaVersion` 並在 `store.js` 加遷移函式與測試。
5. 在里程碑分支(`m3`…)上 commit,訊息格式:`feat(M3): ...`,並引用 Issue 編號。`main` 只能由 PM 透過 PR merge。
6. 不確定的產品決策(習慣清單、部署平台等)見 `PROJECT_PLAN.md` §8,**先問使用者再動手**。

## 協作架構(多交談分工)
本專案由多個交談分工:**PM**(專案管理 + 技術顧問)、**DEV**、**QA**、**UAT**;Gerald 是 Sponsor,只負責重大決策、iPhone UAT 與里程碑結案。完整 R&R、RACI、上線檢查表、回滾與交接規則見 **`docs/process.md`**,開工前必讀。

- 每個交談在啟動說明中會被告知自己的角色;**只改自己角色擁有的檔案**(見 `docs/process.md` §4)。
- 所有交談共用這個資料夾、**不使用 git worktree**;同一時間只有一個交談可以改檔案或切分支,由 PM 派工決定。
- 工作項目與 bug 一律用 GitHub Issues(repo `yangjl96github/reset66`,Milestones `M3`–`M5`)追蹤;狀態以 Issues 為準。
- repo 是公開的:Issue、commit、PR 中不放真實的使用者紀錄或個人資料。
- 需要 Gerald 決定的事,交給 PM 交談彙整後再問,不要各自直接問。

## 禁止事項
- 不使用任何第三方 app 的名稱、圖示、文案、截圖或美術。
- 不加入追蹤、分析、外部 CDN 腳本或任何對外網路請求(M5 的 Sheets 備份除外,且須使用者明確啟用)。
- 不在未告知的情況下刪除或覆蓋使用者資料;匯入一律先確認。

## 新交談承接
依序讀:`CLAUDE.md` → `docs/process.md` → `docs/handoff/pmo.md`(PM 交談)→ 自己被指派的 GitHub Issues。
