// 免登入地圖編輯器開關（ADR-0137）。
// 2026-11-21 暫時關閉：登入頁與地圖圖檔頁不顯示入口，/boundary-editor 顯示暫停說明，
// 公開草稿 API 拒絕寫入。草稿資料、編輯器與管理員入口 /map/boundary-editor 都保留。
// 要重新開放，把這裡改回 true 再部署即可。
export const PUBLIC_BOUNDARY_EDITOR_ENABLED = false
