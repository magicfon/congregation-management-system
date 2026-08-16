# ADR-0003: Google Sheet 雙向同步

日期：2026-08-16
狀態：已接受

## 背景

會眾地圖分配的正式資料來源是 Google Spreadsheet「傳道區域回報」（`1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU`）。大家平常看 Sheet；cHinL 過去手動維護「區域狀態」工作表的 C/D 欄（負責弟兄/分發日期）；傳道員完成後填 Google Form，append 到「傳道區域回報」工作表。

系統上線後兩邊資料各自獨立，需要同步機制。

## 決策

**DB 為主，Sheet 為大家看的鏡像 + 歷史庫。** 系統成熟後 Sheet 不再人工編輯（過渡期仍可能由 cHinL 編輯）。

### 同步方向

1. **DB → Sheet「區域狀態」C/D 欄：即時推**
   - 系統內分發/收回操作成功後，直接更新對應區域列的 C（負責弟兄）/ D（分發日期）欄
   - 收回時清空 C 欄（與現行 Sheet 習慣一致），D 欄保留（下次分發覆蓋）
2. **Form → DB：Vercel Cron 定時拉（每 15 分鐘）**
   - 比對「傳道區域回報」工作表的時間戳記 > 上次同步點，匯入新列
   - **Form 回報視同收回**：匯入時設 `completedAt` = 該列結束日期（取該區域最新一筆），清空 `assignedMemberId`
   - 回報姓名不在 Member 表 → 自動建立（role=default）
3. **Sheet C/D 手動編輯 → DB：快照比對，後寫的贏**
   - Cron 保存上次同步的 C/D 快照
   - Sheet ≠ 快照、DB 未變 → Sheet 贏，匯入 DB
   - Sheet = 快照、DB 變了 → DB 贏，推回 Sheet
   - 兩邊都變 → 衝突 → 通知 cHinL（Discord #會眾管理系統）人工處理

### 區域號碼對應

Sheet 區域號碼為全域 1-213；DB 為 (mapId, mapAreaId)。第一次同步前為 Area 表加上 `sheetNo Int?` 欄，用「區塊編碼 + 區塊內順序」比對一次性回填，之後所有同步走 sheetNo 查找。

### 一次性回填（切換日）

1. 依「區域狀態」現況回填 DB：C → `assignedMemberId`、D → `dispatchedAt`（修復既有 32 筆 dispatchedAt=NULL）
2. 歷史回報（626 筆）可另跑腳本匯入留存（可選，不阻擋上線）

## 後果

- Sheet 保持大家習慣的查看介面，零學習成本
- 系統成為唯一編輯入口，資料一致性由同步保證
- Form 繼續作為傳道員回報管道（未來可被系統內回報功能取代，屆時反向 append 回 Sheet）
- 需要 Google Sheets API 憑證（`~/.hermes/google_token.json` OAuth，已驗證可用）搬進部署環境（Vercel env）
