# ADR-0072：外觀在載入前套用、看板管理區移到下方

2026-10-23，已接受。

## 外觀與系統對齊

使用者問淺色／深色是否真的跟系統對齊。檢查結果：「跟隨裝置」會依 `prefers-color-scheme` 顯示，系統切換時即時跟著變。問題在手動選了淺色或深色的人：伺服器一律先輸出「跟隨裝置」，等 React 載入讀到 localStorage 才換成已存的選擇，所以每次開頁會先閃一下系統色。

- 外觀的 class（`bulletin-theme dashboard-theme`）與 `data-bulletin-theme` 改放在 `<html>`，由 `<head>` 內一段同步小程式在第一次繪製前讀 localStorage 設定；React 之後只更新同一個屬性。body、頁面、portal 與全螢幕閱讀器都從 `<html>` 繼承同一組色彩。
- 「跟隨裝置」的 CSS 改為「不是深色」時跟隨 `prefers-color-scheme: light`，所以讀不到 localStorage（無痕、被封鎖）時仍跟隨系統。
- `<html>` 也帶 `color-scheme`，捲軸與原生控制項的顏色跟著外觀走。
- 選擇仍存在 `bulletin-theme`，不同分頁之間仍會同步。

## 看板管理區

使用者要求「我的看板」裡的管理介面放在下面。管理員看板順序改為：個人服務安排、地圖（若有）、常用管理入口、管理待辦，最後是 LINE 通知與收合的管理工具。一般成員的看板不變。
