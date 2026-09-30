# ADR-0029：LINE Bot 查詢與傳道通知

狀態：Accepted（程式範圍），2026-09-30；正式帳號及 Provider 待確認。

使用者有官方帳號並同意主動通知。第一階段提供「我的地圖／本週行程／待交接」個人查詢及網站入口，塗畫、排程、交接仍在登入網站操作。

使用者另確認每位成員可關閉主動通知：本人儀錶板提供個人開關（預設開啟），僅本人可寫入；關閉會取消 pending，發送前亦重新檢查。重新開啟只收新通知，查詢回覆不受影響；已送交 LINE 的訊息無法撤回。

- Messaging API 與 LINE Login 須同 Provider 才啟用現有 lineuid 直接比對；以伺服器環境旗標確認，不依姓名推測或自動配對。未配對只給登入入口，群組不回傳個人資料。
- Webhook 先對原始 bytes 驗證 HMAC-SHA256，再解析事件。聊天僅唯讀查詢，無權限提升或匿名 mutation。
- plan/reschedule/start 通知目標傳道者；reschedule 更換人員另通知原傳道者；cancel 通知原傳道者；submit 通知本輪地圖管理者。save 不通知。通知只含地圖／日期與網站入口，不含自由文字備註。
- 在同一 DB transaction 建立 outbox；交易成功後才傳送。每筆固定 UUID retry key、收件 UID 與內容；寄送前再次核對成員啟用及 UID。僅暫時錯誤退避重試，24 小時內停止，超時不自動重發。
- 管理員儀錶板顯示設定是否齊全、pending/failed 數量與重試入口；通知排程 endpoint 可由 CRON_SECRET 或管理員呼叫。未設定不累積歷史通知。
- 正式啟用前需設定官方帳號 Messaging API secret/token、同 Provider 確認、Webhook URL，並由使用者加好友後做收發驗證。
