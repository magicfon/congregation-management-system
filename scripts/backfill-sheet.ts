/**
 * 一次性回填腳本（ADR-0003 切換日）
 * 1. Sheet「區域狀態」區域號碼 → Area.sheetNo
 *    對應法：blockCode 相同者，按 Sheet 列順序 = DB mapAreaId 排序一一對應
 * 2. Sheet C/D 欄（負責弟兄/分發日期）→ DB assignedMemberId/dispatchedAt
 * 3. 產出 DB C/D 快照（存 Setting 表），作為之後衝突比對基準
 *
 * 乾跑：npx tsx scripts/backfill-sheet.ts --dry
 * 實跑：npx tsx scripts/backfill-sheet.ts
 *
 * 註：不走 googleapis library（其 refresh 流程與本 token 檔不相容），
 *     直接 REST + 開頭手動 refresh access token（與 Python 相同邏輯）。
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

const SPREADSHEET_ID = '1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU'
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || '/home/chinl-ubuntu/.hermes/google_token.json'

// ---------- Google Sheets REST ----------
type TokenFile = {
  token: string
  refresh_token: string
  client_id: string
  client_secret: string
  expiry: string
}

async function getAccessToken(): Promise<string> {
  const t: TokenFile = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'))
  const expired = !t.expiry || Date.parse(t.expiry) - 60_000 < Date.now()
  if (!expired) return t.token
  // manual refresh
  const body = new URLSearchParams({
    client_id: t.client_id,
    client_secret: t.client_secret,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token',
  })
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`)
  const data = await resp.json()
  t.token = data.access_token
  t.expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
  writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2))
  return t.token
}

async function sheetGet(range: string): Promise<string[][]> {
  const token = await getAccessToken()
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/` +
    encodeURIComponent(range)
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) throw new Error(`Sheets GET ${range} failed: ${resp.status} ${await resp.text()}`)
  const data = await resp.json()
  return data.values || []
}

// ---------- helpers ----------
function sheetDate(v: string): Date | null {
  if (!v) return null
  const s = v.trim()
  // 2025-02-12 or 2025/2/12
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return new Date(Date.UTC(y, mo - 1, d))
  }
  const num = Number(s)
  if (!isNaN(num) && num > 40000) {
    return new Date(Date.UTC(1899, 11, 30) + num * 86400000)
  }
  return null
}

async function main() {
  const rows = await sheetGet('區域狀態!A1:G214')

  // ---- 1. 回填 sheetNo ----
  const areas = await prisma.area.findMany({ orderBy: [{ mapId: 'asc' }, { mapAreaId: 'asc' }] })
  const byBlock = new Map<string, typeof areas>()
  for (const a of areas) {
    const key = a.blockCode || ''
    if (!byBlock.has(key)) byBlock.set(key, [])
    byBlock.get(key)!.push(a)
  }

  console.log(`DB areas: ${areas.length}, Sheet rows: ${rows.length - 1}`)

  type Plan = { areaId: string; sheetNo: number; member?: string; date?: Date }
  const plans: Plan[] = []
  const blockSeen = new Map<string, number>()
  const unmatched: string[] = []
  let lastBlockCode = ''

  for (let i = 1; i < rows.length; i++) {
    const [blockCell, noCell, memberCell, dateCell] = rows[i]
    const sheetNo = Number(noCell)
    if (!sheetNo) continue
    // 合併儲存格：空 blockCode 沿用上一列
    let blockCode = (blockCell || '').toString().trim()
    if (!blockCode) blockCode = lastBlockCode
    else lastBlockCode = blockCode
    const pool = byBlock.get(blockCode)
    if (!pool || pool.length === 0) {
      unmatched.push(`Sheet R${i + 1} blockCode="${blockCode}" 在 DB 找不到`)
      continue
    }
    const seen = blockSeen.get(blockCode) || 0
    blockSeen.set(blockCode, seen + 1)
    const target = pool[seen]
    if (!target) {
      unmatched.push(`Sheet R${i + 1} blockCode="${blockCode}" 第 ${seen + 1} 個超出 DB 數量 (${pool.length})`)
      continue
    }
    const date = sheetDate((dateCell || '').toString())
    plans.push({
      areaId: target.id,
      sheetNo,
      member: (memberCell || '').toString().trim() || undefined,
      date: date || undefined,
    })
  }

  console.log(`matched: ${plans.length}, unmatched: ${unmatched.length}`)
  unmatched.forEach(u => console.log('  ⚠️ ' + u))

  if (DRY) {
    console.log('\n=== DRY RUN — 前 15 筆計畫 ===')
    plans.slice(0, 15).forEach(p => {
      const a = areas.find(x => x.id === p.areaId)!
      console.log(
        `  #${p.sheetNo}: ${a.mapId}/${a.name} (${a.blockCode}) → member=${p.member || '-'} date=${p.date?.toISOString().slice(0, 10) || '-'}`
      )
    })
    return
  }

  // ---- 2. 執行回填 ----
  const memberCache = new Map<string, string>()
  ;(await prisma.member.findMany()).forEach(m => memberCache.set(m.name, m.id))

  let nSheetNo = 0, nAssigned = 0, nNewMember = 0
  for (const p of plans) {
    await prisma.area.update({ where: { id: p.areaId }, data: { sheetNo: p.sheetNo } })
    nSheetNo++

    let memberId: string | undefined
    if (p.member) {
      if (memberCache.has(p.member)) {
        memberId = memberCache.get(p.member)
      } else {
        const nm = await prisma.member.create({
          data: {
            name: p.member,
            email: `sheet-${randomUUID().slice(0, 8)}@placeholder.local`,
            password: randomUUID(),
          },
        })
        memberCache.set(p.member, nm.id)
        memberId = nm.id
        nNewMember++
        console.log(`  + 新 Member: ${p.member}`)
      }
    }

    const data: any = {}
    if (memberId) { data.assignedMemberId = memberId; data.assignedTo = p.member }
    else { data.assignedMemberId = null; data.assignedTo = null }
    if (p.date) data.dispatchedAt = p.date
    await prisma.area.update({ where: { id: p.areaId }, data })
    if (memberId) nAssigned++
  }
  console.log(`\nsheetNo 回填: ${nSheetNo} 筆`)
  console.log(`C/D 欄同步: ${nAssigned} 筆有負責人`)
  console.log(`新建 Member: ${nNewMember} 位（placeholder email）`)

  // ---- 3. 存 C/D 快照到 Setting ----
  const snapshot = plans.map(p => ({
    sheetNo: p.sheetNo,
    member: p.member || '',
    date: p.date?.toISOString().slice(0, 10) || '',
  }))
  await prisma.setting.upsert({
    where: { key: 'sheet_cd_snapshot' },
    create: { key: 'sheet_cd_snapshot', value: JSON.stringify(snapshot) },
    update: { value: JSON.stringify(snapshot) },
  })
  console.log(`C/D 快照已存 Setting.sheet_cd_snapshot (${snapshot.length} 筆)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
