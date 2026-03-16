#!/usr/bin/env tsx
/**
 * 數據導入腳本：從 CSV 導入成員、區域、排班到 Supabase
 * 用法：tsx scripts/import-data.ts [csv路徑]
 * 預設 CSV 路徑：/tmp/sheet2.csv
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as readline from 'readline'
import bcrypt from 'bcryptjs'

// ===================== 配置 =====================

const SUPABASE_URL = 'https://gkclvxkuvyoenpvzubxm.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrY2x2eGt1dnlvZW5wdnp1YnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUzMjg1MywiZXhwIjoyMDg5MTA4ODUzfQ.jybqq4OnHXNBNM_KhdJQtjT4E7-b7fVylBgi6ipIbBY'

const CSV_PATH = process.argv[2] || '/tmp/sheet2.csv'
const BATCH_SIZE = 100
const DEFAULT_PASSWORD = 'Temp123456'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ===================== CSV 欄位名稱 =====================

const COL_TIMESTAMP = '時間戳記'
const COL_MEMBER = '傳道員姓名'
const COL_TIMESLOT = '傳道時段'
const COL_AREA = '區域號碼'
const COL_START = '開始日期'
const COL_END = '結束日期'
const COL_NOTES = '備註'

// ===================== 資料清理 =====================

function normalizeName(raw: string): string {
  if (!raw) return ''
  let name = raw.replace(/\s+/g, '')        // 移除空白：'永久 誠將' → '永久誠將'
  name = name.replace(/[.。]+$/, '')         // 移除尾部標點：'陳清吉.' → '陳清吉'
  name = name.replace('連悦翔', '連悅翔')    // 統一異體字
  name = name.replace('劉 博', '劉博')
  return name.trim()
}

function normalizeTimeSlot(raw: string): string {
  const slot = raw.trim()
  const map: Record<string, string> = {
    '星期六早上': 'saturday_morning',
    '星期日早上': 'sunday_morning',
    '星期三早上': 'wednesday_morning',
    '星期一早上': 'monday_morning',
    '星期三晚上': 'wednesday_evening',
  }
  return map[slot] ?? 'other'
}

function parseDate(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  // YYYY/MM/DD
  const slash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (slash) {
    const [, y, m, d] = slash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  return null
}

// ===================== CSV 解析器 =====================

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = []
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  let headers: string[] = []
  let isFirst = true

  for await (const line of rl) {
    if (!line.trim()) continue
    const fields = parseCSVLine(line)
    if (isFirst) {
      headers = fields
      isFirst = false
      continue
    }
    if (fields.every(f => !f)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = fields[i] ?? '' })
    rows.push(row)
  }

  return rows
}

// ===================== 批量插入 =====================

interface ImportResult {
  attempted: number
  succeeded: number
  errors: string[]
}

async function batchUpsert(
  table: string,
  records: object[],
  label: string
): Promise<ImportResult> {
  const result: ImportResult = { attempted: records.length, succeeded: 0, errors: [] }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(records.length / BATCH_SIZE)

    process.stdout.write(`  批次 ${batchNum}/${totalBatches}...\r`)

    const { error } = await supabase.from(table).upsert(batch as never[], { onConflict: 'id' })
    if (error) {
      const msg = `批次 ${batchNum} 錯誤: ${error.message}`
      result.errors.push(msg)
      console.error(`\n  ❌ ${msg}`)
    } else {
      result.succeeded += batch.length
    }
  }

  process.stdout.write('\n')
  return result
}

// ===================== 主程序 =====================

async function main() {
  const startTime = Date.now()
  console.log('╔══════════════════════════════════════╗')
  console.log('║        數據導入腳本 v1.0             ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`\n📂 CSV 路徑: ${CSV_PATH}`)

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ 找不到 CSV 文件: ${CSV_PATH}`)
    process.exit(1)
  }

  // ---- 解析 CSV ----
  console.log('\n⏳ 解析 CSV...')
  const rows = await parseCSV(CSV_PATH)
  console.log(`✅ 解析完成: ${rows.length} 筆記錄`)

  // 預覽欄位
  if (rows.length > 0) {
    console.log(`   欄位: ${Object.keys(rows[0]).join(', ')}`)
  }

  // ---- 生成預設密碼 ----
  console.log('\n⏳ 生成預設密碼...')
  const hashedPassword = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
  console.log('✅ 密碼生成完成')

  // ================================================================
  // 1. 成員 (Members)
  // ================================================================
  console.log('\n👥 處理成員資料...')

  const memberMap = new Map<string, string>() // normalizedName → memberid
  const memberRecords: object[] = []
  const seenMembers = new Set<string>()

  for (const row of rows) {
    const name = normalizeName(row[COL_MEMBER] || '')
    if (!name || name === '-') continue
    if (seenMembers.has(name)) continue
    seenMembers.add(name)

    const memberid = `member-${name}`
    memberMap.set(name, memberid)
    memberRecords.push({
      id: memberid,
      name,
      email: `${encodeURIComponent(name)}@temp.local`,
      password: hashedPassword,
      role: 'publisher',
      active: true,
    })
  }

  console.log(`   找到 ${memberRecords.length} 位唯一成員`)
  const membersResult = await batchUpsert('members', memberRecords, '成員')
  console.log(`✅ 成員導入: ${membersResult.succeeded}/${membersResult.attempted}`)

  // ================================================================
  // 2. 區域 (Areas)
  // ================================================================
  console.log('\n🗺️  處理區域資料...')

  // 計算每個區域的最後活動日期
  const areaLastDate = new Map<string, string>()
  for (const row of rows) {
    const areaid = (row[COL_AREA] || '').trim()
    if (!areaid || areaid === '-') continue
    const endDate = parseDate(row[COL_END]) || parseDate(row[COL_START])
    if (endDate) {
      const existing = areaLastDate.get(areaid)
      if (!existing || endDate > existing) {
        areaLastDate.set(areaid, endDate)
      }
    }
  }

  const areaRecords: object[] = []
  for (const [areaid, lastDate] of areaLastDate.entries()) {
    areaRecords.push({
      id: areaid,
      name: `區域 ${areaid}`,
      description: '',
      assignedto: null,
      lastactivityat: new Date(lastDate).toISOString(),
    })
  }

  console.log(`   找到 ${areaRecords.length} 個唯一區域`)
  const areasResult = await batchUpsert('areas', areaRecords, '區域')
  console.log(`✅ 區域導入: ${areasResult.succeeded}/${areasResult.attempted}`)

  // ================================================================
  // 3. 排班 (Schedules)
  // ================================================================
  console.log('\n📅 處理排班資料...')

  const scheduleRecords: object[] = []
  let skippedCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = normalizeName(row[COL_MEMBER] || '')

    if (!name || name === '-') { skippedCount++; continue }

    const areaid = (row[COL_AREA] || '').trim()
    if (!areaid) { skippedCount++; continue }

    const memberid = memberMap.get(name)
    if (!memberid) { skippedCount++; continue }

    const date = parseDate(row[COL_END]) || parseDate(row[COL_START])
    if (!date) { skippedCount++; continue }

    const timeslot = normalizeTimeSlot(row[COL_TIMESLOT] || '')
    const notes = (row[COL_NOTES] || '').trim() || null

    scheduleRecords.push({
      id: `schedule-${i + 1}`,
      areaid,
      memberid,
      date: new Date(date).toISOString(),
      timeslot,
      status: 'completed',
      notes,
    })
  }

  console.log(`   有效排班: ${scheduleRecords.length} 筆，跳過: ${skippedCount} 筆`)
  const schedulesResult = await batchUpsert('schedules', scheduleRecords, '排班')
  console.log(`✅ 排班導入: ${schedulesResult.succeeded}/${schedulesResult.attempted}`)

  // ================================================================
  // 導入報告
  // ================================================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║            📊 導入報告               ║')
  console.log('╠══════════════════════════════════════╣')
  console.log(`║  成員: ${String(membersResult.succeeded).padStart(4)}/${String(membersResult.attempted).padEnd(4)} 筆         ║`)
  console.log(`║  區域: ${String(areasResult.succeeded).padStart(4)}/${String(areasResult.attempted).padEnd(4)} 筆         ║`)
  console.log(`║  排班: ${String(schedulesResult.succeeded).padStart(4)}/${String(schedulesResult.attempted).padEnd(4)} 筆         ║`)
  console.log(`║  耗時: ${elapsed.padStart(6)}s               ║`)
  console.log('╚══════════════════════════════════════╝')

  const allErrors = [
    ...membersResult.errors,
    ...areasResult.errors,
    ...schedulesResult.errors,
  ]

  if (allErrors.length > 0) {
    console.log('\n⚠️  錯誤詳情:')
    allErrors.forEach(e => console.log(`   ${e}`))
  }

  const totalFailed =
    (membersResult.attempted - membersResult.succeeded) +
    (areasResult.attempted - areasResult.succeeded) +
    (schedulesResult.attempted - schedulesResult.succeeded)

  if (totalFailed === 0) {
    console.log('\n🎉 所有資料導入成功！')
    console.log(`\n⚠️  注意: 所有成員預設密碼為 '${DEFAULT_PASSWORD}'，請提醒成員登入後修改密碼。`)
  } else {
    console.log(`\n⚠️  有 ${totalFailed} 筆資料導入失敗，請查看上方錯誤詳情。`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ 未預期錯誤:', err)
  process.exit(1)
})
