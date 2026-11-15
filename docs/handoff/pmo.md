# PM 交接文件

> 給承接的 PM 交談:依序讀 `CLAUDE.md` → `docs/process.md` → 本文件 → GitHub Issues(`gh issue list -R yangjl96github/reset66 --milestone M3`)。
> 最後更新:2026-11-15(PM 交談 #1)

## 1. 專案現況

| 項目 | 狀態 |
|---|---|
| 線上網址 | https://yangjl96github.github.io/reset66/ |
| Repo | https://github.com/yangjl96github/reset66(public,`main` = 已部署版本) |
| 目前版本 | `0.2.0`,`sw.js` `CACHE_VERSION = 'v2'`,`schemaVersion = 1` |
| 測試 | `npm test`:6 檔 108 tests 全綠 |
| M0 | 完成,Gerald iPhone 驗收通過 |
| M1 | 完成(`dates` / `progress` / `streak` / `xp` 純函式 + UT) |
| M2 | 完成並部署(引導、今日頁、習慣管理);**Gerald 的 iPhone 驗收尚未回報** |
| M3 | WBS 已核准(`docs/wbs/M3.md`),Issues #1–#7 已建立,**尚未開工** |
| M4 / M5 | Milestone 已建立,尚未拆 WBS;M5 的 Sheets 備份是否要做,待 M4 完成後問 Gerald |

## 2. 角色與運作(摘要,完整見 `docs/process.md`)
- Gerald = Sponsor:只處理重大決策(尤其影響 GitHub 公開內容的事)、iPhone UAT、里程碑結案。他不熟這類開發架構,**PM 交談需擔任技術顧問**,用白話說明並給明確建議。
- PM 交談:WBS、Issues、派工、上線決策(依上線檢查表),Gerald 的 iPhone 測試結果也回報給 PM 交談。
- DEV / QA / UAT 各一個交談;**共用資料夾、不用 worktree、同時只有一個交談改檔案**。

## 3. 已確定的決策紀錄
| 日期 | 決策 |
|---|---|
| 2026-11-15 | §8:佔位習慣清單、起始日預設隔天、GitHub Pages、繁中介面;M5 Sheets 待定 |
| 2026-11-15 | 新增 `habit.archivedAt`(schema v1 即有);休息日、進行中、寬容視窗、獎勵規則見 `PROJECT_PLAN.md` §5 |
| 2026-11-15 | Git 身分:repo 層級 `Gerald <136328766+yangjl96github@users.noreply.github.com>`(不公開真實 email) |
| 2026-11-15 | 多交談分工:PM / DEV / QA / UAT;UT 跟 DEV、SIT 給 QA;SIT 先不加 Playwright(用文件化案例 + 內建瀏覽器) |
| 2026-11-15 | 用 GitHub Issues + Milestones 追蹤;每里程碑一條分支 + PR,QA 審查,PM 依檢查表 merge |
| 2026-11-15 | M3:schema v2 新增 `meta.lastExportAt`;匯入前自動備份(保留 3 份);14 天匯出提醒 |

## 4. 環境注意事項
- 本機:Windows 11 ARM64;Git、Node 26、`gh`(已登入 `yangjl96github`)都已安裝,但**舊交談的 PowerShell PATH 可能沒有**:用 `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`,或 Bash 加 `export PATH="$PATH:/c/Program Files/GitHub CLI"`。PowerShell 用 `npm.cmd` / `npx.cmd`。
- 沒有 Python;本機預覽用 `tools/serve.ps1`(`.claude/launch.json` 的 `reset66`)。
- 專案在 OneDrive 資料夾內。Gerald 同意多交談作業期間**暫停 OneDrive 同步**;每次開新的作業交談前提醒他確認(暫停 24 小時會自動恢復)。
- 內建瀏覽器的 mobile 模擬截圖會被裁切,判斷版面請用 DOM 量測;本機測試 SW 前先 unregister 舊 SW 並清快取。
- Commit 訊息結尾需加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 5. 進行中 / 下一步
1. 提醒 Gerald 暫停 OneDrive 同步 → 開 Dev 交談,從 `main` 切 `m3`,依序做 #1 → #4 → #2 → #3 → #5。
2. Dev 開 PR 後 → 開 QA 交談做 #6。
3. 上線檢查表全過 → PM merge → 開 UAT 交談做 #7 → Gerald iPhone 測試 → Gerald 結案 M3。
4. 追問 Gerald M2 的 iPhone 驗收結果(若有問題開 `bug` Issue)。

## 6. 交談清單
| 角色 | 交談 | 狀態 |
|---|---|---|
| PM | 本交談(PM #1) | 進行中 |
| DEV | 尚未建立 | — |
| QA | 尚未建立 | — |
| UAT | 尚未建立 | — |
