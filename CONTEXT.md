# 地圖分配系統 — 領域詞彙表

## 核心概念

**區域（Area）** — 傳道領土的最小單位。每個區域有編號（如 A-12）、所屬地圖（楠梓/橋頭/梓官）、以及可選的 polygon 邊界。

**區塊（Block）** — 區域的分组單位。一個 blockCode（如 A-1）可包含多個區域，分配時一次分一整組給一人。

**分發（Dispatch）** — 將一組區域指派給某個成員。分發時自動記錄 `dispatchedAt`。

**收回（Collect）** — 管理員將已分發的區域從成員手中收回。收回時設定 `completedAt`。

**分發中（isDispatched）** — 計算欄位：`dispatchedAt != null && (completedAt == null || completedAt < dispatchedAt)`。只有「真實分發中」的區域才算。

**分配目的（assignNote）** — 可選的分配備註。null 代表沒有特別目的。

## 角色

**管理員（admin）** — 可執行收回、轉移等操作。目前只有 admin 角色。

**一般成員** — 所有 LINE 登入的使用者。可查看地圖分配狀態和自己被分到的區域，不能操作收回/轉移。

## 操作規則

- 收回 = 設定 completedAt = now()，清除 assignedMemberId
- 轉移 = 先收回再重新分發（兩步操作）
- 批量收回 = 支援一次收回多張
- 分發天數計算 = now() - dispatchedAt（只在有真實 dispatchedAt 時才算）
- 所有 LINE 登入者可看，只有 admin 可操作

## 資料來源與 Sheet 對接（2026-08-16 確認）

**傳道區域回報 Spreadsheet**（`1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU`）— 大家平常看的正式版本：

- **「傳道區域回報」工作表** — Google Form 回報流水（append-only）。欄位：時間戳記 / 傳道員姓名 / 傳道時段 / 區域號碼 / 開始日期 / 結束日期 / 備註。2022/9 起使用，626 筆，最新 2026/8/14，活躍中。**區域號碼是全域 1-213**（楠梓含個人區域/海總 1-89、橋頭 60-118 左右、梓官 119-213…實際按 blockCode 對應）。
- **「區域狀態」工作表** — 現況表（R1 標題 + R2-R214 共 213 區域）。欄位：區塊編碼 / 區域號碼 / 負責弟兄 / 分發日期 / 最後完成日 / 幾天沒傳了? / 疫情後完成次數。E/F/G 欄是公式（從回報流水算最後完成日/閒置天數/次數），**A/B/C/D 欄是手動維護的**（負責弟兄 + 分發日期）。
- 其他工作表（花費天數圖表 / ID List / 地圖管理人 / 編碼分析 / 樞紐分析）是分析用副本/圖表，不動。

**號碼對應**：Sheet 的全域區域號碼（區域狀態!B 欄）→ DB 的 lookup：先比對 blockCode（A-x = nanzih、B-x = chiaotou、C-x = tzuguan），同 block 內按 mapAreaId 排序對應。個人區域=1、海總=2,3（nanzih）。

**操作現況（2026-08-16 cHinL 確認）**：
- 「區域狀態」C/D 欄（負責弟兄/分發日期）過去都是 **cHinL 一人手動維護**
- 傳道員完成後填 Google Form → append 到「傳道區域回報」→ E/F/G 公式自動算現況

**同步語意（待 grill 確認）**：
- Sheet「區域狀態」C/D 欄（負責弟兄/分發日期）↔ DB `assignedMemberId`/`dispatchedAt` — 雙向
- Sheet「傳道區域回報」append-only 流水 ↔ DB `completedAt` 紀錄 — 單向匯入

