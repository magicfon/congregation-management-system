# ADR-0031：未識別 LINE 身分待管理員連結

日期：2026-10-01
狀態：Accepted

使用者要求未紀錄 UID 顯示「待管理員確認權限」，並出現在成員管理等待連結。實作採 Bot 與網站共用流程：LINE 簽章／OAuth 驗證後才登記身分，不依姓名或 email 自動配對。

- 新 UID 存在獨立 pending_line_identities 表，保存顯示名稱、首次與最近出現時間；UID 唯一，重送不新增重複項目。不建立 Member、不取得角色、不進入派發人選。
- Bot 私訊與加好友事件可登記；群組不登記。名稱由 LINE profile API 取得，失敗仍保存 UID，OAuth 可補齊名稱。
- 未識別 OAuth 登入登記後轉至 /pending-access，不核發新成員工作階段；管理員連結後需重新登入。既有已綁定 Member 與停用規則不變，不追溯猜測哪些舊成員尚待確認。
- 管理員專用 API 在 serializable transaction 檢查 UID 未綁定、目標啟用且無 UID，連結並刪除待確認項目。保留目標姓名、角色、歷史資料；並行連結失敗回 409，不覆蓋既有綁定。
- 公開待確認頁不顯示個人 UID；待確認名單只供管理員讀取。既有跨成員移動 LINE 綁定功能保留。
- 部署先執行冪等新增資料表 SQL，再產生 Prisma client。無既有資料搬移或 Sheet 同步改動。
