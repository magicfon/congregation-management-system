-- 虚擬邊界表格（v2.4）
-- 創建日期：2026-03-22

-- 創建 virtual_boundaries 表格
CREATE TABLE if not exists virtual_boundaries (
    id TEXT primary key,
    map_id text not null,
    name text,
    points jsonb not null,
    color text default '#9333ea',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

COMMENT on 'virtual_boundaries(map_id';
