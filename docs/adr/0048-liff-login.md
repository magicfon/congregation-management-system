# ADR-0048：LIFF 入口登入

日期：2026-10-06；狀態：已接受

使用者確認採 LIFF，減少 LINE 選單進入網站的登入步驟。建立公開 /liff 入口，SDK init 完成後才讀 view；maps、week、handoffs 導向原儀錶板區段，bulletin 保持公開瀏覽。

新增 NextAuth liff Credentials provider；只接受原始 ID token，伺服器透過 LINE verify endpoint 驗證簽章、效期及 LINE_CLIENT_ID audience，再查 UID 綁定。不得信任瀏覽器提交的 UID、姓名或角色。未綁定者登記 PendingLineIdentity 並導向等待頁，不建立 session；停用／刪除成員拒絕登入。JWT 保留 LINE UID，解除綁定後舊 session 失效。CSRF 使用 NextAuth 既有機制。

LINE_LIFF_ID 為公開 ID，由伺服器傳入頁面，須屬現有 LINE_CLIENT_ID，不需要更換 Bot 密鑰。設定後選單 URI 改為 liff.line.me，狀態 key 包含 LIFF ID，避免沿用舊 menu。未設定時原網站選單維持可用。一般網站 OAuth 仍保留，權限及 Sheet 同步不變。

官方設定：LINE Login channel 新增 LIFF，Full、Endpoint https://congregation-management-system.vercel.app/liff，scopes openid、profile。伺服器驗證依 https://developers.line.biz/en/docs/liff/using-user-profile/；query timing 依 https://developers.line.biz/en/tips/2026/07/16/liff-url-additional-info/。
