# AGENTS.md — 地圖分配系統協作指南

歡迎接手。本檔是給 AI coding agent（Codex / Claude Code / 其他）的交接文件。先讀這份，再看 `CONTEXT.md`（領域詞彙）與 `docs/adr/`（架構決策）。

## 專案一句話

會眾傳道區域（領土）分配系統：213 個區域分派給成員、收回、與 Google Sheet 雙向同步。

- **Stack**: Next.js 14 (App Router, `src/` 結構) + Prisma + Neon Postgres + NextAuth（帳密 + LINE 登入）
- **部署**: Vercel production = <https://congregation-management-system.vercel.app>（用 `vercel deploy --prod --yes`，CLI 已登入 magicfon 帳號）
- **資料庫**: Neon（連線字串在 Vercel env `DATABASE_URL`；本機 `.env` 有同步副本，**不可外洩**）
- **Admin 帳號**: `admin@congregation.local` / `admin123`（seed 預設，僅本地/測試用）

## 必讀（依序）

1. `CONTEXT.md` — 領域詞彙（區域/區塊/分發/收回/assignNote）與 Sheet 對接語意
2. `docs/adr/0001`..`0003` — 時間戳語意、人員總覽頁、Sheet 雙向同步
3. `.agents/skills/grill-with-docs/` — **任何新功能先跑這個流程**（與使用者 Q&A 確認需求後記錄到 CONTEXT.md 並寫 ADR，再動手）——使用者明確要求此流程

## 硬規則（違反會出事，都付過學費）

1. **寫入或比較 Sheet 的日期一律用 `taipeiDate()`**（`src/lib/google-sheets.ts`）。在 Vercel（UTC）用 `toISOString().slice(0,10)` 會讓台北日期倒退一天，曾造成 146 筆假衝突。
2. **這個 OAuth token 不可用 googleapis Node 套件**——refresh 會 `invalid_request`。只能用 `src/lib/google-sheets.ts` 的 REST client（手動 refresh_token exchange）。Python `google.auth` 沒這問題。
3. **Sheet 快照必須涵蓋全部 213 區**，不是只有活躍的——部分快照會讓 cron 把保留的日期誤判成手動編輯。
4. **收回（collect）清 C 欄保留 D 欄**；下一次分發會蓋掉 D。
5. **`src/` 結構下 middleware 必須放 `src/middleware.ts`**——放根目錄會被 Next.js 靜默忽略（2026-09-19 修正，見 commit c8c6dd5）。
6. `middleware.ts` 內 `PROTECTED_PAGE_PREFIXES` 與 `config.matcher` 兩份清單要同步維護。
7. 每頁都要包 `DashboardLayout`（側欄 + `p-4 md:p-8` padding）——沒包的頁面內容會貼齊視窗邊緣。

## 部署注意

- Vercel Hobby cron 每日上限一次：次小時級同步靠 home crontab 每 15 分打 `/api/cron/sync-sheet`（Bearer `CRON_SECRET`，存在 Vercel env）。
- 同步改動部署後，**用 Bearer secret 連打 cron endpoint 兩次**，第二次必須全零（第一次可能匯入待處理編輯）。跑壞了要先原子化重對齊 DB/Sheet/snapshot 再重啟。
- `echo "$V" | vercel env add` 會把換行一起存進去 → 部署錯誤「header 有前後空白」。值要寫成無尾換行的檔案再轉向 stdin。
- framework preset 被重設成 "Other" 會全部 404：用 Vercel API PATCH 回 `nextjs` 再 redeploy。

## 慣例

- Commit 訊息：中文、`fix:`/`feat:`/`ui:` 前綴
- UI：深色主題、`mc-*` Tailwind class（定義在 `tailwind.config.js`）
- 使用者偏好：管理頁先顯示決策摘要、細節點開再看；不塞太多功能；新功能先問操作流程

## 驗證

- `npx tsc --noEmit -p tsconfig.json` 過了才 commit
- 部署後煙霧測試：未登入逛 `/dashboard` 應 307 導向 `/login`；`/login` 回 200
