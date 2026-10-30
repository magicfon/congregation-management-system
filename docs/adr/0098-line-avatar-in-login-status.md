# ADR-0098: 登入狀態顯示 LINE 大頭貼

日期：2026-10-30
狀態：已接受

## 決策

使用者要求在登入狀態加上 LINE 頭像。登入已統一只用 LINE（ADR-0088），因此：

- 成員新增 `linePictureUrl` 欄位（只加不刪，`prisma/line-picture-url.sql`）。每次 LINE OAuth 或 LIFF 登入時，跟 `lineDisplayName` 一起更新；只接受 https 網址。
- JWT 每次從成員資料讀 `linePictureUrl` 放進 `token.picture`，`/api/me` 回傳 `image`。
- 側欄「登入者」左邊顯示圓形頭像；桌機收合側欄時，原本的 ◉ 按鈕改顯示頭像。
- 沒有頭像（尚未重新登入、LINE 沒給、圖片載入失敗）時維持原本樣式。
- LINE 配對轉移時頭像跟著 UID 移動；刪除成員時一併清除。

## 後果

既有登入者要等下一次 LINE 登入（OAuth 或從 LINE 開啟 LIFF）才會記錄頭像。使用者在 LINE 換頭像後，舊網址可能失效，畫面會退回原樣式，下次登入更新。
