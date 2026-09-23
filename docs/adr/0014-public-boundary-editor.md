# ADR-0014：免認證地圖編輯入口

2026-09-23，使用者在確認任何持有網址的人皆能修改共用草稿後，明確選擇開放雲端讀取與儲存。

## 決定

新增 `/boundary-editor`，使用 DashboardLayout 與既有編輯器 iframe，登入頁提供入口。公開 iframe 以 access=public 選用 `/api/public/map-boundary-drafts/[mapId]`。公開頁與公開 API 不需 session，使用相同 Neon 草稿表及原子版本更新。

既有 `/map/boundary-editor` 與 `/api/map-boundary-drafts/[mapId]` 仍限管理員。將草稿讀寫提取為共用處理函式，公開入口以 public-editor 記錄修改來源，不假冒具名管理員。API 回應不暴露 updatedBy 帳號；只提供草稿、版本、地圖及更新時間。

保留地圖白名單、2 MB 限制、JSON 與幾何驗證、同源檢查、no-store 及 409 版本衝突。其他管理頁、分發與正式區域資料不受影響。

## 驗證

匿名公開讀寫、管理 API 仍拒絕匿名、公開與管理入口共用版本、並發衝突、錯誤來源／格式／地圖拒絕。部署後匿名公開頁回 200、草稿 GET 回 200，無效 PUT 回 400；不使用正式草稿作寫入測試。
