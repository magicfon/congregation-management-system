# ADR-0047：LINE 選單開啟網頁

日期：2026-10-06；狀態：已接受

使用者確認將圖文選單改為直接開啟網頁，供 LINE 手機 App 瀏覽。四格使用 URI，我的地圖／本週行程／待交接導向 dashboard?view=maps|week|handoffs，公布欄導向 bulletin。儀錶板資料載入後定位區段，管理員待交接預選相同分類。

沿用 LINE OAuth 與會員權限；未登入先登入，目的地 query 保留。保留 Bot 私訊查詢，不整合 LIFF。

新選單狀態使用 line_rich_menu_v2，避免誤用舊訊息動作的 menu ID。發布使用原有鎖及 expectedCurrentId，原選單不刪除。雲端選單 API 允許既有 CRON_SECRET 操作，與通知 API 採相同操作授權，供 Sensitive Token 僅可於雲端讀取時發布；其餘仍要求 admin。
