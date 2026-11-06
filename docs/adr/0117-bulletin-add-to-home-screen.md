# ADR-0117：公布欄加到手機桌面

2026-11-06，已接受。

## 背景

使用者希望公布欄有一個按鈕，按下去 Android 與 iPhone 都能把公布欄加到手機桌面當捷徑。各平台限制不同：

- Android Chrome（及多數 Chromium 瀏覽器）在網站有 Web App Manifest 時會發出 `beforeinstallprompt`，網頁可在使用者點擊時叫出系統安裝視窗。
- iPhone／iPad 不提供任何程式介面，只能由使用者在分享選單點「加入主畫面」；加入的是當下網址。
- LINE、Facebook 等 App 內建瀏覽器兩種都不支援。弟兄姊妹多半從 LINE 圖文選單進公布欄。

## 決策

- 新增 `src/app/manifest.ts`：名稱「楠梓會眾公布欄」、短名「公布欄」、`start_url` 與 `id` 為 `/bulletin`、`display: standalone`。圖示放 `public/icons/bulletin-192.png`、`bulletin-512.png`（兼作 maskable）與 `public/apple-touch-icon.png`，圖案沿用公布欄標頭的面板圖示，藍底白線。
- 根 layout 加 `appleWebApp` 中繼資料，並用內嵌腳本先接住 `beforeinstallprompt`（可能早於 React 水合），存在 `window.__bulletinInstallPrompt`。
- 公布欄 ☰ 選單在「我的看板／登入」下方多一項「加到手機桌面」（`AddToHomeScreen.tsx`）：
  - 有安裝提示（Android Chrome、電腦版 Chrome）：直接叫出系統安裝視窗。
  - iPhone：顯示三步驟說明；在分類頁按時先導到 `/bulletin?add-to-home=1` 再顯示，確保捷徑是公布欄首頁。
  - Android 但沒有安裝提示（其他瀏覽器或已安裝過）：顯示「⋮ → 加到主畫面」步驟。
  - LINE 等內建瀏覽器：說明要改用 Chrome／Safari，提供「用瀏覽器開啟」（網址帶 `openExternalBrowser=1`）與「複製公布欄網址」；外部瀏覽器開啟後自動跳出說明。
  - 已從桌面開啟（standalone）時不顯示；電腦版沒有安裝提示時也不顯示。
- `?add-to-home=1` 只用來自動打開說明，打開後立刻從網址移除。
- 不加 Service Worker，不做離線快取，內容仍即時讀取。

## 影響

- manifest 與圖示套用全站，但捷徑一律開公布欄首頁。
- 從桌面開啟是全螢幕、沒有網址列；公布欄分類頁標頭已有返回鍵。iPhone 桌面 App 的登入狀態與 Safari 分開，要用看板需在桌面 App 內重新登入。
- 無資料庫、Sheet 同步或 LINE 選單變更。
