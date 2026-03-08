import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET() {
  try {
    // 創建 territories 表
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

    // 創建 schedules 表
    await sql`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        time_slot VARCHAR(50) NOT NULL,
        group_name VARCHAR(50),
        leader VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 創建 reports 表
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        publisher_name VARCHAR(100) NOT NULL,
        time_slot VARCHAR(50),
        territory_id INTEGER REFERENCES territories(id),
        start_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 創建 persons 表
    await sql`
      CREATE TABLE IF NOT EXISTS persons (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 檢查是否已有數據
    const { rows: existingTerritories } = await sql`SELECT COUNT(*) FROM territories`
    
    if (existingTerritories[0].count === '0') {
      // 添加種子數據
      await sql`
        INSERT INTO territories (code, number, responsible_brother, split_date, status, days_idle)
        VALUES 
          ('A-1', 1, '柳鴻軒', '2025-02-12', 'active', 15),
          ('A-2', 2, '連建賜', '2025-03-03', 'active', 7),
          ('A-3', 3, '洪政英', '2023-08-30', 'idle', 120),
          ('個人區域', 0, NULL, NULL, 'active', 5),
          ('海總', 0, NULL, NULL, 'active', 10)
      `

      await sql`
        INSERT INTO schedules (time_slot, group_name, leader, is_active)
        VALUES 
          ('星期一上午', '集體', '黃修睦', true),
          ('星期三早上', '集體', '永久誠將', true),
          ('星期三晚上', '集體', '連建聰', true),
          ('星期五', '集體（電話見證OR挨家挨戶）', '易達夫', true),
          ('星期六', '集體', '劉博', true),
          ('星期日', 'AB', '曾湖', true),
          ('星期日', 'CD', '宮西真悟', true)
      `

      await sql`
        INSERT INTO persons (name, role, is_active)
        VALUES 
          ('黃修睦', '弟兄', true),
          ('永久誠將', '弟兄', true),
          ('連建聰', '弟兄', true),
          ('易達夫', '弟兄', true),
          ('劉博', '弟兄', true),
          ('曾湖', '弟兄', true),
          ('宮西真悟', '弟兄', true),
          ('柳鴻軒', '弟兄', true),
          ('連建賜', '弟兄', true),
          ('洪政英', '弟兄', true)
      `
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully',
      tables: ['territories', 'schedules', 'reports', 'persons']
    })
  } catch (error) {
    console.error('Database initialization failed:', error)
    return NextResponse.json({ 
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
