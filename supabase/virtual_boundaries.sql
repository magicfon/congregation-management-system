-- 虛擬邊界表格（v2.4）
-- 創建日期：2026-03-22

-- 創建 virtual_boundaries 表格
CREATE TABLE IF NOT EXISTS virtual_boundaries (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL,
    name TEXT,
    points JSONB NOT NULL,
    color TEXT DEFAULT '#9333ea',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_virtual_boundaries_map_id ON virtual_boundaries(map_id);

-- 設置 RLS (Row Level Security)
ALTER TABLE virtual_boundaries ENABLE ROW LEVEL SECURITY;

-- 創建政策：允許所有人讀取
CREATE POLICY "Allow public read access" ON virtual_boundaries
    FOR SELECT
    USING (true);

-- 創建政策：允許所有人插入
CREATE POLICY "Allow public insert access" ON virtual_boundaries
    FOR INSERT
    WITH CHECK (true);

-- 創建政策：允許所有人更新
CREATE POLICY "Allow public update access" ON virtual_boundaries
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 創建政策：允許所有人刪除
CREATE POLICY "Allow public delete access" ON virtual_boundaries
    FOR DELETE
    USING (true);

-- 創建更新時間戳記的函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 創建觸發器：自動更新 updated_at
DROP TRIGGER IF EXISTS update_virtual_boundaries_updated_at ON virtual_boundaries;
CREATE TRIGGER update_virtual_boundaries_updated_at
    BEFORE UPDATE ON virtual_boundaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 註釋
COMMENT ON TABLE virtual_boundaries IS '虛擬邊界表，用於存儲用戶自定義的邊界線';
COMMENT ON COLUMN virtual_boundaries.id IS '唯一標識符';
COMMENT ON COLUMN virtual_boundaries.map_id IS '地圖 ID（如 nanzih, chiaotou, tzuguan）';
COMMENT ON COLUMN virtual_boundaries.name IS '邊界名稱';
COMMENT ON COLUMN virtual_boundaries.points IS '邊界點陣列，JSONB 格式 [{x, y}, ...]';
COMMENT ON COLUMN virtual_boundaries.color IS '邊界顏色（十六進制）';
COMMENT ON COLUMN virtual_boundaries.created_at IS '創建時間';
COMMENT ON COLUMN virtual_boundaries.updated_at IS '更新時間';
