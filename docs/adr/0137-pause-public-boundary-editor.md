# ADR-0137：暫停免登入地圖編輯器

2026-11-21，已接受。暫停 ADR-0014 的公開入口。

## 背景

使用者決定暫時不開放地圖編輯，未來需要時再打開。

## 決策

- 新增 `src/lib/public-boundary-editor.ts` 的 `PUBLIC_BOUNDARY_EDITOR_ENABLED`，目前為 `false`。
- 登入頁拿掉「地圖編輯器（免登入）」連結與說明，地圖圖檔頁拿掉「地圖編輯器」連結。
- `/boundary-editor` 不再載入編輯器，改顯示「地圖編輯暫停開放」，舊連結不會 404。
- 公開草稿 API `PUT /api/public/map-boundary-drafts/[mapId]` 回 403，持有網址也不能寫入；GET 照常。
- 入口不在 LINE 選單，不需重新發布 LINE。

## 不變

- `map_boundary_drafts` 資料、編輯器靜態檔、共用讀寫函式保留。
- 管理員入口 `/map/boundary-editor` 與 `/api/map-boundary-drafts/[mapId]` 不受影響。

## 重新開放

把 `PUBLIC_BOUNDARY_EDITOR_ENABLED` 改回 `true` 並部署即可，入口、頁面與公開寫入一起恢復。
