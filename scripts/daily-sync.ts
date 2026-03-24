#!/usr/bin/env npx tsx
/**
 * Daily Sync Script - Congregation Management System
 * 
 * 功能：
 * 1. 從 Supabase 讀取 areas 表資料
 * 2. 同步到 Google Sheet（需要配置 GOOGLE_SHEETS_CREDENTIALS 和 GOOGLE_SPREADSHEET_ID）
 * 3. 記錄同步統計
 * 4. 錯誤處理
 * 
 * 使用方式：
 *   npx tsx scripts/daily-sync.ts
 * 
 * 環境變量：
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase 專案 URL
 *   SUPABASE_SERVICE_KEY - Supabase Service Role Key
 *   GOOGLE_SHEETS_CREDENTIALS - Google Service Account JSON (可選)
 *   GOOGLE_SPREADSHEET_ID - Google Sheet ID (可選)
 */

import { createClient } from '@supabase/supabase-js'

// ============== 類型定義 ==============
interface Area {
  id: string
  name: string
  description: string | null
  assignedTo: string | null
  lastActivityAt: string
  createdAt: string
  updatedAt: string
}

interface SyncStats {
  totalRecords: number
  syncedRecords: number
  skippedRecords: number
  errors: string[]
  startTime: Date
  endTime?: Date
  duration?: number
}

// ============== 配置 ==============
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID

// ============== Supabase 客戶端 ==============
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的環境變量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ============== 主要功能 ==============

/**
 * 從 Supabase 讀取 areas 表資料
 */
async function fetchAreasFromSupabase(): Promise<Area[]> {
  console.log('📊 從 Supabase 讀取 areas 資料...')
  
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Supabase 查詢失敗: ${error.message}`)
  }

  console.log(`✅ 成功讀取 ${data?.length || 0} 筆資料`)
  return data || []
}

/**
 * 同步資料到 Google Sheets
 * 注意：需要安裝 googleapis 套件並配置憑證
 */
async function syncToGoogleSheets(areas: Area[], stats: SyncStats): Promise<void> {
  // 檢查是否有 Google Sheets 憑證
  if (!GOOGLE_SHEETS_CREDENTIALS || !GOOGLE_SPREADSHEET_ID) {
    console.log('⚠️  Google Sheets 憑證未配置，跳過同步到 Google Sheets')
    console.log('   如需啟用，請設置以下環境變量：')
    console.log('   - GOOGLE_SHEETS_CREDENTIALS: Google Service Account JSON')
    console.log('   - GOOGLE_SPREADSHEET_ID: Google Sheet ID')
    stats.skippedRecords = areas.length
    return
  }

  console.log('📝 同步資料到 Google Sheets...')
  
  try {
    // 動態導入 googleapis（如果已安裝）
    const { google } = await import('googleapis').catch(() => {
      throw new Error('googleapis 套件未安裝。請執行：npm install googleapis')
    })

    // 解析憑證
    const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS)
    
    // 建立 JWT 客戶端
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // 準備資料
    const headers = ['ID', '名稱', '描述', '負責人', '最後活動時間', '建立時間', '更新時間']
    const rows = areas.map(area => [
      area.id,
      area.name,
      area.description || '',
      area.assignedTo || '',
      new Date(area.lastActivityAt).toLocaleString('zh-TW'),
      new Date(area.createdAt).toLocaleString('zh-TW'),
      new Date(area.updatedAt).toLocaleString('zh-TW')
    ])

    // 清空現有資料並寫入新資料
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: 'Areas!A:G'
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: 'Areas!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers, ...rows]
      }
    })

    stats.syncedRecords = areas.length
    console.log(`✅ 成功同步 ${areas.length} 筆資料到 Google Sheets`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    stats.errors.push(`Google Sheets 同步失敗: ${errorMessage}`)
    console.error('❌ Google Sheets 同步失敗:', errorMessage)
  }
}

/**
 * 輸出同步統計
 */
function printStats(stats: SyncStats): void {
  stats.endTime = new Date()
  stats.duration = stats.endTime.getTime() - stats.startTime.getTime()

  console.log('\n' + '='.repeat(50))
  console.log('📈 同步統計報告')
  console.log('='.repeat(50))
  console.log(`開始時間: ${stats.startTime.toLocaleString('zh-TW')}`)
  console.log(`結束時間: ${stats.endTime.toLocaleString('zh-TW')}`)
  console.log(`執行時間: ${(stats.duration / 1000).toFixed(2)} 秒`)
  console.log('-'.repeat(50))
  console.log(`總記錄數: ${stats.totalRecords}`)
  console.log(`已同步:   ${stats.syncedRecords}`)
  console.log(`已跳過:   ${stats.skippedRecords}`)
  console.log(`錯誤數:   ${stats.errors.length}`)
  
  if (stats.errors.length > 0) {
    console.log('\n❌ 錯誤詳情:')
    stats.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`)
    })
  }
  console.log('='.repeat(50))
}

/**
 * 主函數
 */
async function main(): Promise<void> {
  const stats: SyncStats = {
    totalRecords: 0,
    syncedRecords: 0,
    skippedRecords: 0,
    errors: [],
    startTime: new Date()
  }

  console.log('🚀 開始每日同步任務')
  console.log(`📅 執行時間: ${stats.startTime.toLocaleString('zh-TW')}`)
  console.log('-'.repeat(50))

  try {
    // 1. 從 Supabase 讀取資料
    const areas = await fetchAreasFromSupabase()
    stats.totalRecords = areas.length

    // 2. 同步到 Google Sheets
    await syncToGoogleSheets(areas, stats)

    // 3. 輸出統計報告
    printStats(stats)

    // 4. 如果有錯誤，以非零狀態碼退出
    if (stats.errors.length > 0) {
      process.exit(1)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    stats.errors.push(errorMessage)
    printStats(stats)
    console.error('\n💥 嚴重錯誤:', errorMessage)
    process.exit(1)
  }
}

// 執行主函數
main()
