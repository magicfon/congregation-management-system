/**
 * 切換日修正：套用「Form 回報 = 收回」規則到歷史資料
 * Sheet「區域狀態」E 欄（最後完成日，公式算出）> D 欄（分發日期）→ 該區域已完成收回
 * → completedAt = E，清空 assignedMemberId
 *
 * 執行：npx tsx scripts/fix-completed.ts
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'fs'

const prisma = new PrismaClient()
const SPREADSHEET_ID = '1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU'
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || '/home/chinl-ubuntu/.hermes/google_token.json'

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
  if (!resp.ok) throw new Error(`Sheets GET failed: ${resp.status} ${await resp.text()}`)
  return (await resp.json()).values || []
}

function parseDate(v: string): Date | null {
  if (!v) return null
  const s = v.trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const num = Number(s)
  if (!isNaN(num) && num > 40000) return new Date(Date.UTC(1899, 11, 30) + num * 86400000)
  return null
}

async function main() {
  const rows = await sheetGet('區域狀態!A1:E214')
  const areas = await prisma.area.findMany({ include: { assignedMember: true } })
  const bySheetNo = new Map(areas.map(a => [a.sheetNo, a]))

  let nStillAssigned = 0, nCollected = 0
  const snapshot: { sheetNo: number; member: string; date: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const [, noCell, , dCell, eCell] = rows[i]
    const sheetNo = Number(noCell)
    const area = bySheetNo.get(sheetNo)
    if (!area) continue

    const dispatchedAt = parseDate((dCell || '').toString())
    const lastDone = parseDate((eCell || '').toString())
    const memberName = area.assignedMember?.name || ''

    // E > D → 已完成收回
    if (area.assignedMemberId && lastDone && dispatchedAt && lastDone > dispatchedAt) {
      await prisma.area.update({
        where: { id: area.id },
        data: {
          completedAt: lastDone,
          assignedMemberId: null,
          assignedTo: null,
          // dispatchedAt 保留原值
        },
      })
      nCollected++
      snapshot.push({ sheetNo, member: '', date: dCell || '' })
    } else {
      if (area.assignedMemberId) nStillAssigned++
      snapshot.push({
        sheetNo,
        member: area.assignedMemberId ? memberName : '',
        date: dispatchedAt ? dispatchedAt.toISOString().slice(0, 10) : '',
      })
    }
  }

  console.log(`仍分發中: ${nStillAssigned} 筆`)
  console.log(`已收回修正: ${nCollected} 筆`)

  await prisma.setting.upsert({
    where: { key: 'sheet_cd_snapshot' },
    create: { key: 'sheet_cd_snapshot', value: JSON.stringify(snapshot) },
    update: { value: JSON.stringify(snapshot) },
  })
  console.log('快照更新完成')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
