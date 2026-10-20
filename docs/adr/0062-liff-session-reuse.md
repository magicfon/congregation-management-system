# ADR-0062：LIFF 沿用同帳號登入

日期：2026-10-20；狀態：已接受

使用者確認同一裝置、同一 LINE 帳號且登入仍有效時直接進入；過期、登出或換帳號才重新驗證。維持既有 30 天 session 有效期。

LIFF SDK 仍先初始化以還原目的地與辨識目前帳號。入口向 NextAuth 讀取 session，由既有 JWT callback 重新檢查成員啟用與 LINE 綁定，再於瀏覽器比較 session 的 LINE UID 與 SDK 的目前 UID。同帳號才略過 `signIn('liff')`，省去 LINE verify、個人資料寫入及重建 session。未登入、缺少 UID、帳號不同或 session 無效皆走原始 ID token 的伺服器驗證。

Session 只在成員身分有效時提供本人 LINE UID；瀏覽器讀取的 UID 僅用來決定是否重登入，不作為後端授權依據，不新增信任瀏覽器 UID 的 API。停用／刪除／解除綁定仍立即使 session 失效。公開公布欄維持免登入。

不快取 ID token 或在 localStorage 記錄已驗證旗標。LINE SDK 初始化與平台導轉仍可能等待，這次只省去本站重複驗證，不承諾固定登入秒數。

依據：[LINE 使用者資料處理規則](https://developers.line.biz/en/docs/liff/using-user-profile/)、[LIFF 初始化流程](https://developers.line.biz/en/docs/liff/developing-liff-apps)。
