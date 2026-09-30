# LINE Bot 正式串接

目前程式預設停用，不會發送通知，也不補發停用期間的歷史異動。

1. 在 LINE Developers 確認既有官方帳號 Messaging API 與網站 LINE Login 在**同一個 Provider**。若不同，先不要啟用 `LINE_BOT_SAME_PROVIDER`；需另設安全帳號連結流程，不可用姓名推測 UID。
2. 在 Vercel 專案 Production 環境變數設定（勿貼到聊天或提交 Git）：
   - `LINE_BOT_CHANNEL_SECRET`：Messaging API channel 的 Channel secret，與 Login secret 不同。
   - `LINE_BOT_ACCESS_TOKEN`：Messaging API channel access token。
   - `LINE_BOT_SAME_PROVIDER=true`：僅確認相同 Provider 後設定。
   - `LINE_BOT_ENABLED=true`：正式啟用開關。
3. 重新部署後，管理員儀錶板「LINE Bot 通知」應顯示已啟用。
4. 官方帳號 Webhook URL 設為 `https://congregation-management-system.vercel.app/api/line-bot/webhook`，按 Verify 並開啟 Use webhook。若原帳號已有其他 webhook 服務，先確認整合方式，不直接覆蓋。避免既有自動回覆重複回答相同指令。
5. 管理員及測試傳道者加入官方帳號好友，使用網站 LINE 登入並完成成員配對。私訊「我的地圖」「本週行程」「待交接」確認只看到本人資料；群組不回覆。
6. 使用實際安排測試 plan、reschedule、start、submit：目標人收到預排／交接；管理者收到局部提交提醒。塗畫草稿不通知。重新分配預排時原人員會收到改派提醒。

## 通知失敗

每位使用者可在儀錶板「我的 LINE 主動通知」關閉。關閉會取消待發通知，不影響主動查詢；重新開啟不補發已取消的通知。已送交 LINE 的訊息無法撤回。

網站異動成功與通知傳送分開：通知 outbox 與傳道異動同一 transaction 儲存，送出失敗不撤销安排。暫時錯誤以固定 retry key 重試，23 小時後過期，不會無期限重送；永久 4xx 與 UID 變更標記失敗。

日常每次異動會嘗試傳送該次通知；管理員可按「重試待發通知」處理已到時間的 pending（每批 5 則）。如需自動重試，可在既有 home 排程新增 POST `/api/line-bot/notifications`，使用相同 CRON_SECRET Bearer，每 5–15 分鐘執行；Vercel Hobby 不另外新增高頻 cron。既有 Sheet 同步 endpoint 不變。

LINE 200/409 accepted 不代表對方已讀或一定可收到（例如已封鎖官方帳號）。通知不含自由文字交接備註，詳情需在網站登入查閱。

官方參考：[Webhook 驗證](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)、[UID 與 Provider](https://developers.line.biz/en/docs/messaging-api/getting-user-ids/)、[重送規則](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)。
