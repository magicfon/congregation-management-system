-- v2.4.1 遷移：將虛擬邊界改為單一邊界模式
-- 每張地圖只能有一個虛擬邊界

-- 步驟 1: 刪除舊的多餘邊界（保留每張地圖最新的邊界）
DELETE FROM virtual_boundaries
WHERE id NOT IN (
    SELECT MAX(id)
    FROM virtual_boundaries
    GROUP BY map_id
);

-- 步驟 2: 移除舊的主鍵（如果存在）
ALTER TABLE virtual_boundaries DROP CONSTRAINT IF EXISTS virtual_boundaries_pkey;

-- 步驟 3: 添加唯一約束（每張地圖只能有一個虛擬邊界）
ALTER TABLE virtual_boundaries
ADD CONSTRAINT unique_map_boundary UNIQUE (map_id);

-- 步驟 4: 設置 map_id 為主鍵
ALTER TABLE virtual_boundaries
ADD PRIMARY KEY (map_id);

-- 步驟 5: 移除 id 欄位（可選，保留以便追蹤創建時間）
-- 如果想完全移除 id 欄位，取消下面的註釋：
-- ALTER TABLE virtual_boundaries DROP COLUMN id;

-- 說明：
-- 1. 保留 id 欄位用於追蹤記錄，但實際主鍵改為 map_id
-- 2. upsert 操作使用 onConflict: 'map_id' 來確保唯一性
-- 3. 前端代碼使用 .eq('map_id', currentMapId) 進行查詢和刪除
