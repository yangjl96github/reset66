# Reset66 開發流程與 R&R

> 所有交談開工前必讀。狀態以 GitHub Issues / Milestones 與 repo 文件為準,不依賴任何交談的記憶。

## 1. 角色

| 代號 | 角色 | 擔任者 | 職責 |
|---|---|---|---|
| **Sponsor** | 專案擁有者 | Gerald | 重大決策核准、iPhone UAT 執行、里程碑結案 |
| **PM** | 專案管理 + 技術顧問 | PM 交談 | WBS、Issues、派工、進度、上線決策;協助 Gerald 判斷技術問題並以白話溝通 |
| **DEV** | 開發 | Dev 交談 | 實作、unit test、bug 修正、開 PR |
| **QA** | 整合測試 | QA 交談 | PR 審查、SIT 設計與執行、檢查 UT 涵蓋、回報 bug |
| **UAT** | 使用者測試 | UAT 交談 | PC UAT 執行、iPhone UAT 清單、將 UAT 結果登錄為 Issue |

## 2. RACI

R = 執行、A = 最終核准(唯一)、C = 事前諮詢、I = 事後告知

| # | 工作項目 | Gerald | PM | DEV | QA | UAT |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | 產品決策、範圍變更(重大者) | **A** | R | C | C | I |
| 2 | WBS 拆解、驗收標準、核准 | I | **A/R** | C | C | C |
| 3 | Milestone / Issues 建立 | I | **A/R** | I | I | I |
| 4 | 派工與進度追蹤 | I | **A/R** | I | I | I |
| 5 | 實作 + unit test | | A | **R** | C | |
| 6 | PR 程式碼審查 | | A | C | **R** | |
| 7 | SIT 案例設計與執行 | | A | I | **R** | |
| 8 | Bug 修正 | | A | **R** | C | C |
| 9 | Merge 到 `main` + 部署 | I | **A/R** | I | C | I |
| 10 | PC UAT 執行 | I | A | | | **R** |
| 11 | iPhone UAT 清單 | I | A | | | **R** |
| 12 | iPhone UAT 執行 | **R** | I | | | C |
| 13 | UAT 結果登錄 Issue | I | A | | | **R** |
| 14 | 里程碑結案 | **A** | R | I | I | I |
| 15 | `CLAUDE.md` / 本流程維護 | I | **A/R** | C | C | C |

### 必須先問 Gerald 的事(其餘由 PM 決定)
- 影響 GitHub 公開內容或帳號的操作:repo 設定與可見度、刪除分支/Issue/Release、force push、Pages 設定。
- 產品範圍或遊戲化規則的變更、`PROJECT_PLAN.md` §8 類型的產品決策。
- 新增任何依賴(目前只允許 `vitest`)、引入建置工具或框架。
- 任何可能遺失使用者資料的變更。
- 里程碑結案。

## 3. 里程碑流程

```
PM 拆 WBS → 建 Issues → DEV 在分支 mN 實作 + UT → 開 PR
  → QA 審查 PR + 跑 SIT → (bug → DEV 修 → QA 重測)
  → PM 依上線檢查表 merge → GitHub Pages 自動部署
  → UAT 交談做 PC UAT + 產出 iPhone 清單 → Gerald iPhone UAT(結果回報給 PM 交談)
  → PM 彙整 → Gerald 結案
```

## 4. 工作規則

### 共用資料夾(不使用 worktree)
- 所有交談共用同一個資料夾,**同一時間只有一個交談可以改檔案或切分支**,由 PM 派工決定誰在作業。
- 作業中的交談不得切換到別的分支;交還時工作區必須乾淨(已 commit)。
- 檔案歸屬:

| 交談 | 可改 | 不可改 |
|---|---|---|
| PM | `PROJECT_PLAN.md`、`CLAUDE.md`、`docs/process.md`、`docs/wbs/`、`docs/handoff/` | `src/`、`tests/` |
| DEV | `src/`、`tests/`(unit)、`sw.js`、`index.html`、`styles.css`、`manifest.webmanifest`、`icons/`、`tools/`、`package*.json` | WBS、測試報告 |
| QA | `tests/sit/`、`docs/test/` | `src/`(發現問題開 Issue,不自行修) |
| UAT | `docs/uat/` | `src/`、`tests/` |

### 分支與 commit
- 每個里程碑一條分支:`m3`、`m4`…,從 `main` 切出;bug 修在同一分支。
- `main` = 已部署到 iPhone 的版本,只能由 PM 透過 PR merge。
- Commit 訊息:`feat(M3): ...`、`fix(M3): ...`、`test(M3): ...`、`docs: ...`,並在訊息中引用 Issue(`Refs #12`、修好用 `Fixes #12`)。

### Issues
- 標題格式:`[M3] 簡述`。
- Labels:類型 `task` / `bug`;負責 `dev` / `sit` / `uat`;嚴重度(bug 才需要)`blocker` / `critical` / `major` / `minor`。
- 每個 Issue 寫清楚:目的、範圍、驗收標準。
- **repo 是公開的**:Issue 內不貼含真實習慣紀錄的截圖或資料,需要附資料時用測試資料。

## 5. 上線檢查表(PM merge 前逐項確認)

- [ ] `npm test` 全綠
- [ ] QA 已在 PR 上核准審查
- [ ] SIT 案例全部通過(報告在 `docs/test/`)
- [ ] 沒有未關閉的 `blocker` / `critical` bug
- [ ] 若資料結構有變:`schemaVersion` 已提升、有遷移函式與測試、「舊版資料升級後可讀」SIT 已通過
- [ ] `sw.js` 快取內容有變時,`CACHE_VERSION` 已提升

任何一項不符 → 不 merge,PM 回報 Gerald。

## 6. 回滾

`main` 上線後發現嚴重問題:
1. `git revert -m 1 <merge commit>` 建立回滾 commit。
2. **再把 `sw.js` 的 `CACHE_VERSION` 提升到新的號碼**(不要沿用舊號碼),確保手機會換掉快取。
3. push 到 `main`,確認 Pages 部署完成;開 `bug` Issue 追蹤原因。

## 7. 交接

- PM 交談維護 `docs/handoff/pmo.md`。
- 更新時機:每個里程碑結束、交談發生自動摘要壓縮之後、或 PM 發現需要回頭查細節時。更新後提醒 Gerald 開新的 PM 交談承接。
- 新交談承接時依序讀:`CLAUDE.md` → `docs/process.md` → `docs/handoff/pmo.md` → GitHub Issues。
