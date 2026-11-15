# Reset66 — 個人 66 天習慣養成 PWA 專案計畫

> 目標:自用、免訂閱、可離線的遊戲化習慣追蹤 PWA,安裝到 iPhone 主畫面使用。
> 靈感來源是市面上的「66 天習慣」類 app,但**只借用通用概念**(每日任務、連續天數、XP、等級),不使用任何第三方的名稱、美術、文案或截圖。

---

## 1. 目標與非目標

### 目標
- 66 天個人化計畫:自訂習慣清單,每天勾選完成。
- 進度:`Day X / 66`、連續天數(streak)、XP、等級、日曆熱圖。
- 完全離線可用,資料存本機,可匯出/匯入 JSON 備份。
- 加到 iPhone 主畫面後,體驗接近原生 app。
- 無帳號、無伺服器、無訂閱、無追蹤。

### 非目標(第一版不做)
- Web Push 推播(iOS 需要伺服器,過重)。提醒改用 iOS 捷徑 / 提醒事項。
- 桌面小工具、螢幕封鎖(PWA 做不到)。
- 排行榜、社群功能。
- 原生 iOS 版本。

---

## 2. 技術選型

| 項目 | 決定 | 理由 |
|---|---|---|
| 語言 | Vanilla JavaScript(ES Modules) | 無建置步驟,最容易維護與除錯 |
| 樣式 | 單一 `styles.css`,CSS 變數,深色主題為預設 | 簡單 |
| 儲存 | `localStorage`(單一 key,JSON) + 匯出/匯入 | 資料量極小,不需要 IndexedDB |
| 離線 | Service Worker(cache-first 靜態資源) | PWA 必備 |
| 測試 | Vitest,只測純邏輯模組 | 連續天數與 XP 邏輯最容易出錯 |
| 部署 | GitHub Pages 或 Cloudflare Pages | PWA 安裝與 Service Worker 需要 HTTPS |

> 若 Claude Code 評估後認為需要建置工具,可改用 Vite,但須先說明理由並得到使用者同意。

---

## 3. 專案結構

```
reset66/
├── CLAUDE.md                # 給 Claude Code 的開發規範
├── PROJECT_PLAN.md          # 本文件
├── index.html
├── manifest.webmanifest
├── sw.js                    # Service Worker
├── styles.css
├── icons/                   # 原創圖示 192 / 512 / maskable / apple-touch-icon
├── src/
│   ├── main.js              # 進入點、路由、事件綁定
│   ├── store.js             # 讀寫 localStorage、遷移、匯出入
│   ├── logic/               # 純函式,不碰 DOM、不碰 localStorage
│   │   ├── dates.js         # 日期與「一天的邊界」處理
│   │   ├── streak.js        # 連續天數、寬容規則
│   │   ├── xp.js            # XP、等級
│   │   └── progress.js      # Day X/66、完成判定
│   └── ui/
│       ├── today.js         # 今日清單
│       ├── habits.js        # 習慣管理(新增/編輯/封存)
│       ├── stats.js         # 統計與熱圖
│       └── settings.js      # 設定、匯出入
└── tests/
    ├── dates.test.js
    ├── streak.test.js
    ├── xp.test.js
    └── progress.test.js
```

---

## 4. 資料模型

整個 app 狀態是一個 JSON 物件,存在 `localStorage["reset66.v1"]`。

```jsonc
{
  "schemaVersion": 1,
  "program": {
    "startDate": "2026-11-16",      // YYYY-MM-DD,本地時區
    "targetDays": 66,
    "dayBoundaryHour": 4,           // 凌晨 4 點前仍算前一天
    "graceDays": 1,                 // 每 7 天允許漏 1 天而不斷 streak
    "completionThreshold": 1.0      // 當日完成比例達標才算「完成日」(0~1)
  },
  "habits": [
    {
      "id": "h_xxxx",
      "title": "早上 8 點起床",
      "cue": "鬧鐘響後直接下床",    // 觸發線索,可空
      "xp": 10,
      "days": [0,1,2,3,4,5,6],      // 0=週日,預設每天
      "archived": false,
      "archivedAt": null,           // 封存日 YYYY-MM-DD;當天起不再計入,之前的紀錄保留
      "createdAt": "2026-11-15"
    }
  ],
  "logs": {
    "2026-11-16": { "h_xxxx": "done" }   // done | skipped(skipped 不計入分母)
  },
  "profile": { "bonusXp": 0 }            // 其餘 XP 由 logs 推導,不重複存
}
```

**原則:衍生資料(XP、等級、streak、Day X)一律由 `logs` 即時計算,不存結果**,避免不一致。

---

## 5. 遊戲化規則

### 完成日
- 當日「應做習慣」(排除 skipped 與非排程日)完成比例 ≥ `completionThreshold` 即為完成日。
- **進度以「完成日數」計算**,不是日曆天數。達到 66 個完成日即結業。
  (設計依據:習慣形成研究的重點是重複次數;研究也顯示漏一天影響很小。)
- 應做習慣數為 0 的日子(全部 skipped 或當天沒排程)為「休息日」:不算完成日、不斷 streak、不消耗寬容。
- 今天尚未達標時為「進行中」,不會斷 streak。
- 完成日至少要有 1 個習慣完成(避免 `completionThreshold = 0` 時空白日也算數)。

### Streak(連續天數)
- 連續完成日數。
- 寬容規則:任意滾動 7 天內最多漏 `graceDays` 天,不斷 streak(但該日不計入完成日)。
- 設定 `graceDays = 0` 即為嚴格模式(類似「困難模式」)。
- 視窗定義:以漏掉的那天為結尾往前 7 天(含當天);streak 為 0 時漏掉不計。

### XP 與等級
- 每完成一個習慣:`+habit.xp`(預設 10)。
- 當日全數完成:`+20` 額外獎勵(skipped 不算在內;只達 threshold 不算全數完成)。
- Streak 獎勵:streak 每到 7 的倍數時 `+50`;斷掉後重新累積到 7 會再給一次。
- 等級門檻(累積 XP 達到才升級):`xpToReach(L) = 50 * L * (L - 1)`
  - L1=0、L2=100、L3=300、L4=600、L5=1000 …
- 數值全部集中在 `logic/xp.js` 頂部的常數,方便調整。

---

## 6. 里程碑與驗收標準

### M0 — 骨架與部署
- [x] `index.html`、`manifest.webmanifest`、`sw.js`、基本樣式
- [x] 原創 app 圖示(SVG 轉 PNG:192、512、maskable、180 apple-touch)
- [x] 部署到 GitHub Pages(或 Cloudflare Pages)
- **驗收**:iPhone Safari 開啟 → 加入主畫面 → 全螢幕開啟;開飛航模式仍可開啟。

### M1 — 核心邏輯(純函式 + 測試)
- [x] `dates.js`:本地日期字串、`dayBoundaryHour` 處理、日期區間
- [x] `progress.js`:完成日判定、Day X/66
- [x] `streak.js`:含寬容規則
- [x] `xp.js`:XP 與等級
- **驗收**:`npm test` 全綠;至少涵蓋——跨午夜邊界、漏一天寬容、連漏兩天斷掉、全部 skipped 的日子、閏年/月底。

### M2 — 基本 UI
- [x] 今日頁:習慣清單、勾選/略過、`Day X/66`、streak、XP 條
- [x] 習慣管理:新增、編輯、封存、排程星期
- [x] 首次啟動引導:選擇起始日、建立初始習慣(使用 `seed-habits`,見 §8)
- **驗收**:可在手機上完整走完「建立計畫 → 勾選一天 → 看到 XP 與 streak 變化」。

### M3 — 持久化與備份
- [ ] `store.js`:讀寫、`schemaVersion` 遷移機制
- [ ] 設定頁:匯出 JSON(下載/分享)、匯入 JSON(含驗證與覆蓋確認)
- [ ] 請求 `navigator.storage.persist()`
- **驗收**:匯出 → 清空 → 匯入後狀態完全一致;損毀的 JSON 不會讓 app 崩潰。

### M4 — 統計與打磨
- [ ] 日曆熱圖(過去 66+ 天)
- [ ] 各習慣完成率
- [ ] 升級/結業動畫(輕量 CSS)、深色主題微調、安全區域(safe-area)處理
- **驗收**:iPhone 瀏海/Home 指示條不遮擋內容;Lighthouse PWA 檢查通過。

### M5 — 選配
- [ ] Google Sheets 備份:Apps Script Web App 接收 JSON,寫入試算表(使用者自己的專案,單向備份即可)
- [ ] iOS 捷徑提醒的設定教學放進 README
- [ ] 每日一句短語/反思欄(單行日誌)

---

## 7. 已知風險與對策

| 風險 | 對策 |
|---|---|
| iOS Safari 可能清除未安裝網站的儲存 | 引導加入主畫面;呼叫 `storage.persist()`;設定頁提示定期匯出 |
| 跨午夜與時區造成「今天」判定錯誤 | 日期一律用本地時區字串 `YYYY-MM-DD`;邊界邏輯集中在 `dates.js` 並重點測試 |
| Service Worker 快取導致更新不生效 | 快取名稱帶版本號;`activate` 時清舊快取;設定頁顯示版本號 |
| 本機開發無法測 SW 於手機 | `localhost` 可測桌面;手機測試走部署或 HTTPS 隧道 |
| 使用者忘記備份 | 每 14 天於今日頁溫和提醒匯出 |

---

## 8. 待使用者確認(Claude Code 開工前請先問)

1. **預設習慣清單**:目前沒有指定。請使用者提供;若無,先放這組佔位項目讓他之後自行修改:
   `早起`、`運動`、`喝水 2L`、`閱讀 20 分鐘`、`冥想 10 分鐘`、`數位排毒`。
2. **起始日**:預設隔天;可在引導頁選擇。
3. **部署平台**:GitHub Pages 或 Cloudflare Pages。
4. **介面語言**:預設繁體中文。
5. **是否要做 M5 的 Sheets 備份**。

### 決議(2026-11-15)
1. 預設習慣:採用上列佔位清單。
2. 起始日:預設隔天,引導頁可改。
3. 部署:GitHub Pages。
4. 介面語言:繁體中文。
5. M5 Sheets 備份:M4 完成後再決定。

---

## 9. 法律與原創性

- 習慣追蹤、連續打卡、XP/等級屬通用機制,可自由實作。
- **不得**使用其他 app 的名稱、Logo、圖示、插畫、文案、截圖。
- 圖示與配色需原創(可用簡單幾何 SVG)。
