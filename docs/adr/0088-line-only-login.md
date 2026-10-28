# ADR-0088：登入統一由 LINE 認證

2026-10-28，已接受。

登入頁只有 LINE 登入，但 NextAuth 仍註冊 email／密碼的 `credentials` provider。seed 建立的 `admin@congregation.local`／`admin123` 若存在正式資料庫，任何人都能透過 `/api/auth/callback/credentials` 以管理員登入。使用者要求刪除所有帳密登入，統一由 LINE 認證。

## 決定

- 移除 `credentials`（email／密碼）provider；`/api/auth/callback/credentials` 不再存在。
- 保留 LINE OAuth 與 LIFF（LIFF 用 LINE ID token，不是帳密）。
- 成員資料表的 `password` 欄位保留（現有建立成員流程寫入隨機雜湊），不再用於登入；不刪除任何成員。
- seed 仍可建立本機測試資料，但帳號無法用密碼登入。
