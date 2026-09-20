# ADR-0006: LINE 顯示名稱與成員配對

日期：2026-09-20
狀態：已接受

## 決策

使用者確認僅需要 LINE 顯示名稱與 UID。沿用 Member.lineuid 唯一綁定，新增可空的 lineDisplayName；OAuth 驗證成功後更新顯示名稱，不改成員姓名。舊 UID 的顯示名稱於下次登入補齊，不以既有成員姓名猜測。

後台僅管理員可查看完整 UID 及執行配對；從已綁定來源成員選擇未綁定且啟用的目標成員，確認後在 serializable transaction 中移動 UID 與顯示名稱。目標已有 UID、來源已變更或配對自己時拒絕；不合併或刪除任何成員歷史資料。

登入身分僅以 UID 查找，不再以 email 自動配對。新 LINE 使用者仍自動建立 publisher；密碼使用隨機不可預測值。JWT 每次檢查成員是否啟用及 UID 綁定是否一致，配對後原登入失效，必須重新登入。

成員 API 使用明確回傳欄位，不回傳密碼雜湊；非管理員名單不回傳 LINE 識別資料。資料庫只新增 nullable 欄位，使用冪等 SQL 更新既有資料庫。

`npm run build` 先執行 `db:line-profile`，成功新增欄位後才生成 Prisma client 與建置，避免自動部署先上新程式卻缺少欄位。既有版本可繼續使用新增欄位後的資料庫；部署環境須提供既有 DATABASE_URL / DIRECT_DATABASE_URL 與 ALTER TABLE 權限。
