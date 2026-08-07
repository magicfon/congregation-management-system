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
