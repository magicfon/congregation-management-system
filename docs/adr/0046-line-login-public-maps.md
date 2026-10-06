# ADR-0046：LINE 登入介面與公開地圖下載

狀態：已接受；日期：2026-10-06

使用者要求移除登入頁帳密輸入，僅保留 LINE 登入，並開放下載地圖頁免登入。

移除帳密表單、分隔線及其提交程式，保留 LINE OAuth 的 callbackUrl、錯誤提示及登入中狀態。此需求限定登入介面，既有 credentials provider 保留供原有流程使用。

`/map-images` 從 middleware 的 PROTECTED_PAGE_PREFIXES 與 matcher 同時移除。圖檔頁只讀公開靜態地圖索引、預覽與下載圖檔，無成員或領取資料；仍使用 DashboardLayout。登入頁新增免登入下載入口。地圖分配、回報及成員 API 原權限保留。
