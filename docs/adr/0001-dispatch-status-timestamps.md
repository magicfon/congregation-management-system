# ADR-0001: 分發狀態使用 dispatchedAt/completedAt 時間戳計算

## 狀態
Accepted

## 背景
原本系統只靠 `assignedMemberId` 是否為 null 來判斷分發狀態。無法區分「分發中」和「已完成收回等待重新分發」。

## 決策
使用 `dispatchedAt`（分發時間）和 `completedAt`（收回時間）兩個 DateTime? 欄位計算 `isDispatched`：

- `dispatchedAt != null && (completedAt == null || completedAt < dispatchedAt)` → 分發中
- `completedAt > dispatchedAt` → 已收回，可重新分配
- 只有真實分發操作才設定 dispatchedAt，不回填歷史日期

## 後果
- 從 Sheet 同步的舊資料（dispatchedAt = null）不會顯示分發天數
- 只有未來新增的分發才會有分發天數計算
- 需要在 UI 顯示時區分「有日期的分發中」和「無日期的分配（舊資料）」
