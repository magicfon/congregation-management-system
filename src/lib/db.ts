import { sql } from '@vercel/postgres'

// 獲取數據庫連接
export const db = sql

// 初始化數據庫
export async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS territories (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        number INTEGER,
        responsible_brother VARCHAR(100),
        split_date DATE,
        last_completed_date DATE,
        days_idle INTEGER DEFAULT 0,
        post_pandemic_completions INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log('Database initialized')
  } catch (error) {
    console.error('Database initialization failed:', error)
  }
}
