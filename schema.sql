-- 會眾傳道區域管理系統數據庫 Schema

-- 區域表
CREATE TABLE IF NOT EXISTS territories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- 區域編碼 (如 A-1)
  number INTEGER,                       -- 區域號碼
  name TEXT,                            -- 區域名稱
  responsible_brother TEXT,             -- 負責弟兄
  split_date TEXT,                      -- 分裂日期
  last_completed_date TEXT,             -- 最後完成日
  days_idle INTEGER DEFAULT 0,          -- 幾天沒傳了
  post_pandemic_completions INTEGER DEFAULT 0, -- 疫情後完
  status TEXT DEFAULT 'active',         -- 狀態: active, idle, completed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 傳道回報表
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,              -- 時間戳記
  publisher_name TEXT NOT NULL,         -- 傳道員姓名
  time_slot TEXT,                       -- 傳道時段
  territory_id INTEGER,                 -- 區域號碼
  start_date TEXT,                      -- 開始日期
  notes TEXT,                           -- 備註
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (territory_id) REFERENCES territories(id)
);

-- 排班表
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_slot TEXT NOT NULL,              -- 時段
  group_name TEXT,                      -- 組別
  leader TEXT,                          -- 帶頭
  is_active BOOLEAN DEFAULT 1,          -- 是否啟用
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 人員表
CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,            -- 姓名
  role TEXT,                            -- 角色
  is_active BOOLEAN DEFAULT 1,          -- 是否活躍
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_territories_code ON territories(code);
CREATE INDEX IF NOT EXISTS idx_territories_status ON territories(status);
CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp);
CREATE INDEX IF NOT EXISTS idx_reports_publisher ON reports(publisher_name);
CREATE INDEX IF NOT EXISTS idx_schedules_time_slot ON schedules(time_slot);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);

-- 視圖：區域狀態總覽
CREATE VIEW IF NOT EXISTS territory_overview AS
SELECT 
  t.id,
  t.code,
  t.number,
  t.responsible_brother,
  t.split_date,
  t.last_completed_date,
  t.days_idle,
  t.post_pandemic_completions,
  t.status,
  COUNT(r.id) as report_count
FROM territories t
LEFT JOIN reports r ON t.id = r.territory_id
GROUP BY t.id;

-- 視圖：傳道員統計
CREATE VIEW IF NOT EXISTS publisher_stats AS
SELECT 
  publisher_name,
  COUNT(*) as total_reports,
  COUNT(DISTINCT territory_id) as territories_worked,
  MIN(timestamp) as first_report,
  MAX(timestamp) as last_report
FROM reports
GROUP BY publisher_name;
