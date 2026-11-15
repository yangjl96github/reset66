# M3 SIT 報告 — 持久化與備份

- Issue:#6 `[M3] PR review and SIT` ・ PR:#8(`m3` → `main`)
- 受測版本:`m3` @ `700de15`(APP_VERSION 0.3.0、schemaVersion 2、`CACHE_VERSION` v3)
- 執行者:QA 交談 ・ 日期:2026-11-15
- 環境:Windows 11 ARM64、Claude 桌面版內建瀏覽器(Chromium),`tools/serve.ps1`(no-cache)

## 摘要

| 項目 | 結果 |
|---|---|
| SIT 案例 | **25 / 25 通過**,0 失敗 |
| `npm test` | 204 / 204 通過(11 個檔案) |
| 發現缺陷 | 0(另有 4 項觀察,見文末,皆非阻擋) |
| 結論 | **通過**:M3 驗收標準 1、2、3、5 與 WBS M3-6 要求的範圍皆通過;驗收標準 4(iPhone 分享選單/「檔案」App)留待 UAT |
| 回歸(84464ff) | **3 / 3 通過**(SIT-20、21、22 重測);`npm test` 205 / 205,見文末「Regression after 84464ff」 |

## 測試方法

- 測試前:解除所有 service worker、刪除所有 Cache Storage、清空 `localStorage`。
- 測試資料一律是手寫的測試資料(習慣名稱如「測試早起」),沒有使用真實紀錄。
- 選檔以 `DataTransfer` 設定 `input.files` 後觸發 `change` 模擬(瀏覽器檔案對話框無法自動化)。
- 下載匯出檔以包裝 `URL.createObjectURL` 擷取 Blob;分享選單以替換 `navigator.canShare` / `navigator.share` 模擬(成功與 `AbortError`)。
- deep equal 以「鍵排序後的 JSON 字串」比較。
- 升級路徑與離線測試在獨立 origin(`localhost:8003`)進行:先服務 `git archive main` 的檔案,再以 `git archive m3` 覆蓋同一資料夾模擬 Pages 部署;離線以停止伺服器達成(對 origin 的 fetch 確認失敗)。
  - 註:內建瀏覽器只對 `.claude/launch.json` 內的設定啟動的伺服器送出 service worker 腳本請求,因此暫時加入一個 `qa-upgrade` 設定,測完已還原,未 commit。
- 375 px 判定:`document.documentElement.scrollWidth` 與所有元素的 `getBoundingClientRect()`(不依賴截圖)。
- 測試結束後已清空 8000 / 8002 / 8003 三個 origin 的 `localStorage`、`sessionStorage`、service worker 與快取。

## 案例

| ID | 對應 | 步驟 | 預期結果 | 實際結果 | 結果 |
|---|---|---|---|---|---|
| SIT-01 | 驗收 1、D5 | 載入 v1 測試資料(起始日 26 天前、3 個習慣含 1 個封存、4 天紀錄)→ 設定 → 匯出備份 → 清空 `localStorage` → 重新整理 → 引導頁「從備份還原」→ 選匯出檔 → 匯入 | 儲存的 state 與「匯出完成後」的 state deep equal;今日頁沒有備份提醒;不產生備份 key | deep equal = true;無 `.reminder`;只有 `reset66.v1`;toast「已匯入備份」;導向 `#/today` | 通過 |
| SIT-02 | M3-2 | 設定 → 匯出備份(桌面下載路徑) | 檔名 `reset66-backup-2026-11-15.json`、`application/json`;信封 `{app, format:1, appVersion:"0.3.0", exportedAt, data}`;`data.meta.lastExportAt` = 今天;`data` 等於匯出後 app 的 state;設定頁「上次匯出」更新 | 全部符合;`exportedAt` = `2026-11-15T17:57:24+08:00`;「上次匯出 11/15(日)」 | 通過 |
| SIT-03 | M3-2、D5 | 模擬觸控裝置可分享:`share()` 丟 `AbortError` → 再模擬 `share()` 成功 | 取消:不下載、state 不變、無 toast;成功:`lastExportAt` = 今天 | 取消:0 次下載、state 位元組相同;成功:`2026-11-15` | 通過 |
| SIT-04 | 驗收 2 | 有資料時於設定頁匯入下列檔案:非 JSON、空檔、二進位、`42`、`null`、`[1,2]`、`{hello:1}`、`app:"other"`、`app` 為 HTML 字串、信封缺 `data`、habits 非陣列、狀態 `maybe`、日期鍵 `2026-13-01`、重複 habit id | 每種都顯示中文錯誤訊息與「目前的資料沒有任何變更」;app 不崩潰;`localStorage` 不變 | 訊息分別為「無法讀取:這不是有效的 JSON 檔案。」「這不是 Reset66 的備份檔。」「備份檔內容不完整或已損毀,無法匯入。」;全部 `localStorage` 快照相同 | 通過 |
| SIT-05 | M3-3 | 匯入 5 MB + 1 byte 的檔案 | 「檔案超過 5 MB…」,資料不變 | 符合 | 通過 |
| SIT-06 | M3-3 | 匯入版本過新的檔案:信封內 `schemaVersion: 3`、純 state `schemaVersion: 99`、信封 `format: 2` | 「這份備份來自較新版本的 Reset66,請先更新 app 再匯入。」,資料不變 | 三種皆符合 | 通過 |
| SIT-07 | 驗收 2 | `localStorage` 放入截斷的 JSON → 重新整理 | 不崩潰;原始字串另存 `reset66.v1.corrupt.<ISO>`;引導頁顯示「先前的資料無法讀取,已另存一份備份…」 | 符合;副本內容與原字串相同 | 通過 |
| SIT-08 | 驗收 2 | `localStorage` 放入合法 JSON 但 `habits: "oops"` → 重新整理 | 同 SIT-07 | 符合 | 通過 |
| SIT-09 | 驗收 2、D2 | `localStorage` 放入 `schemaVersion: 3` 的資料 → 重新整理 → 改 hash 到 `#/settings`、`#/habits` | 顯示「請先更新 app」封鎖畫面,只有「重新整理」按鈕;tab bar 隱藏;不產生損毀副本;資料位元組不變 | 全部符合;hash 導覽仍停在封鎖畫面 | 通過 |
| SIT-10 | 驗收 3 | 手寫 M2 時期 v1 資料(其中一個習慣缺 `archivedAt`)→ 重新整理 | 自動遷移並立即寫回:`schemaVersion: 2`、新增 `meta: {lastExportAt: null}`、缺的 `archivedAt` 補 `null`;其餘(含所有 logs)不變 | 與預期 v2 物件 deep equal | 通過 |
| SIT-11 | M3-3 | 有資料時匯入合法檔 → 分別以底部「取消」、標題列「取消」、點背景、Esc 關閉預覽 | 資料不變、不產生備份 key | 四種方式皆符合 | 通過 |
| SIT-12 | M3-3 | 有資料時匯入合法檔,檢查預覽 | 顯示匯出時間、起始日、習慣數(含封存數)、有紀錄的天數;「匯入會覆蓋…覆蓋前會自動另存…」警告;按鈕「覆蓋並匯入」 | 「2026/11/15 17:57 / 10/21(三) / 3 個(含 1 個已封存)/ 5 天」,警告與按鈕正確;無資料時(引導頁)按鈕為「匯入」且無覆蓋警告 | 通過 |
| SIT-13 | M3-3 | 連續確認匯入 5 次(每次內容不同) | 每次覆蓋前另存目前資料到 `reset66.v1.backup.<ISO>`;最多保留 3 份,且為最近 3 次覆蓋前的資料 | 份數 1→2→3→3→3;最新備份都等於覆蓋前資料;留下的 3 份正是第 3–5 次覆蓋前的資料 | 通過 |
| SIT-14 | D4 | 讓 `setItem` 對備份 key 丟 `QuotaExceededError` → 確認匯入 | 取消匯入,資料不變,顯示錯誤 toast | 資料不變;toast「無法寫入儲存空間,資料沒有變更」;仍停在設定頁 | 通過 |
| SIT-15 | M3-5 | `lastExportAt` = 13 天前 → 今日頁 | 沒有提醒 | 沒有 `.reminder` | 通過 |
| SIT-16 | M3-5 | `lastExportAt` = 14 天前 → 今日頁 → 點提醒 → 匯出 → 回今日頁 | 顯示「距離上次備份已經 14 天…」;點擊後到設定頁且焦點在「匯出備份」;匯出後提醒消失 | 全部符合 | 通過 |
| SIT-17 | M3-5 | (a) 從未匯出、起始日 26 天前;(b) 從未匯出、計畫明天才開始 | (a) 顯示「還沒有備份過資料…」;(b) 不顯示 | 符合 | 通過 |
| SIT-18 | D1 | 清空資料 → 引導頁「從備份還原」:(a) 選非 Reset66 檔;(b) 選合法匯出檔 | (a) 錯誤訊息,不寫入任何 key;(b) 還原成功(見 SIT-01) | 符合 | 通過 |
| SIT-19 | 驗收 5 | 引導頁「開始計畫」(第一次存檔)時監看 `navigator.storage.persist()`;開設定頁 | 第一次存檔後呼叫 `persist()`;設定頁「儲存空間」顯示與 `navigator.storage.persisted()` 一致的狀態與 iPhone 說明 | 呼叫 1 次;`persisted()` = false,設定頁顯示「未啟用」與說明文字 | 通過 |
| SIT-20 | M3-6 | 新 origin 安裝 m3 service worker 後檢查快取 | `CACHE_VERSION` v3;`reset66-v3` 含全部 precache(含新的 `persist.js`、`logic/schema.js`、`logic/backup.js`、`ui/backup.js`);舊 `reset66-v2` 被刪除;設定頁版本「0.3.0 · reset66-v3」 | 29 個項目,4 個新檔都在;只剩 `reset66-v3` | 通過 |
| SIT-21 | 升級路徑、驗收 3 | 以 `main`(0.2.0)安裝 v2 快取並載入 v1 資料 → 部署 `m3` 檔案 → 重新整理 | 新 SW 接管(skipWaiting + claim + 自動 reload);跑 0.3.0;v1 資料遷移為 v2 且無遺失 | 0.2.0 / `reset66-v2` → 0.3.0 / `reset66-v3`(29 項);資料與預期 v2 deep equal;無損毀副本 | 通過 |
| SIT-22 | M3-6 | SIT-21 後停止伺服器 → 重新整理 `#/settings` → 匯出 → 匯入預覽 → 習慣頁 | 離線仍可開啟所有頁面;匯出與匯入不需網路 | 全部可用 | 通過 |
| SIT-23 | 版面 | 375 × 812:今日頁(含提醒)、習慣頁、設定頁、匯入預覽、匯入錯誤、引導頁、「請先更新 app」畫面 | 無水平溢出 | 全部 `scrollWidth` = 375,無元素超出 viewport | 通過 |
| SIT-24 | 安全(XSS) | 測試資料中習慣名稱 `<img src=x onerror=…>`、提示 `<script>…</script>`,在今日、習慣頁與匯入預覽顯示;匯入 `app` 為 HTML 字串的檔案 | 以純文字顯示,不產生 `<img>`,腳本不執行 | 文字原樣顯示;`#app` 內 0 個 `img`;`window.__xss` 未被設定 | 通過 |
| SIT-25 | 上線檢查表 | `npm test` | 全綠 | 204 / 204 | 通過 |

## 不在 SIT 範圍(留給 UAT)
- 驗收 4:iPhone 分享選單存到「檔案」App、從「檔案」選檔匯入(需實機)。
- 「已啟用持久化儲存」與「此瀏覽器不支援」兩種狀態在內建瀏覽器無法重現,由 `tests/persist.test.js` 覆蓋。

## 觀察事項(非缺陷,不阻擋 merge)
1. **載入時的嚴格驗證可能讓資料「看起來消失」**:M2 的 `looksLikeState` 很寬鬆,v2 的 `validateState` 嚴格。若手機上的 v1 資料有任何欄位不合規,升級後會被移到 `reset66.v1.corrupt.<ISO>`,使用者看到引導頁,而 iPhone 上沒有任何介面能取回損毀副本。已確認 `main` 的 `createHabit` / `normalizeHabitInput` / `archiveHabit` 產生的資料都符合 v2 驗證,所以由 M2 介面建立的資料不會觸發。但 0.2.0 沒有匯出功能,merge 前無法先備份。建議:引導頁的損毀提示加一個「下載損毀副本」按鈕(後續里程碑)。
2. **匯出成功是推定的**:下載路徑在觸發下載後就更新 `lastExportAt`;分享失敗(非 `AbortError`)時改用下載,這時已經過了 `await`,可能失去 user activation,iOS 有可能不下載,但仍會記錄為已匯出、提醒消失。請 UAT 在 iPhone 確認。
3. ~~**`sw.js` 的 `cache.addAll` 使用預設 HTTP 快取模式**~~ → 已由 84464ff 修正(見下方回歸)。
4. **Unit test 缺口**(SIT 已補驗):`main.js` 的 `importState`「先備份、後覆蓋」順序沒有 UT(SIT-14 驗過);沒有用 `main` 分支實際產生器產生的 v1 fixture(SIT-10 / 21 驗過);`loadState` 遷移後寫回失敗的路徑沒有 UT。

## Regression after 84464ff

- 範圍:`fix(M3): precache bypasses HTTP cache`。`sw.js` install 改為 `cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))`,`tests/sw.test.js` 新增 1 個案例。`CACHE_VERSION` 維持 v3:v3 還沒上線,`main` 仍是 v2,所以手機一定會換快取,這樣是正確的。
- 程式碼審查:沒有問題。Cache Storage 以 URL 比對,`Request` 的 cache mode 不影響 `caches.match`;fetch handler 與 activate 都沒有改動。
- 日期:2026-11-15 ・ 受測版本:`m3` @ `84464ff` ・ 環境、方法與正式 SIT 相同(獨立 origin `localhost:8003`,暫時加入的 `qa-upgrade` launch 設定已還原,未 commit)。

| ID | 案例 | 實際結果 | 結果 |
|---|---|---|---|
| R-01 | `npm test` | 205 / 205(11 個檔案) | 通過 |
| R-02(SIT-21) | 升級路徑:`main` 0.2.0 + `reset66-v2`(25 項)+ v1 測試資料 → 部署 84464ff 的檔案 → 重新整理 | 新 SW 接管並自動 reload;0.3.0;只剩 `reset66-v3`(29 項,含 4 個新模組、`index.html`、icons);資料與預期 v2 deep equal;沒有損毀副本 | 通過 |
| R-03(SIT-22) | 停止伺服器(fetch 確認失敗)→ 重新整理 `#/settings` → 匯出 → 匯入預覽 → 習慣頁 | 全部可用,版本 0.3.0 | 通過 |
| R-04(SIT-20) | 乾淨 origin(先解除 SW、刪除快取並關閉分頁)→ 首次載入 | `reset66-v3` 含 29 項(含 `./` 與 `index.html`);伺服器 log 顯示 install 時 PRECACHE 的 29 個檔案都向伺服器發出請求,即使頁面剛載入過同樣的檔案 | 通過 |

測試結束後已清除 8003 origin 的 `localStorage`、`sessionStorage`、service worker 與快取。
