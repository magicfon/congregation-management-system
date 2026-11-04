import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { DEFAULT_SHEET_ID, readValues } from '../../../../lib/google-sheets'
import { recentReports } from '../../../../lib/area-report-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 回報表上千列，連點多區時共用一分鐘內讀到的內容
const CACHE_MS = 60 * 1000
let cache: { at: number; rows: Promise<string[][]> } | null = null
function reportRows() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rows = readValues(DEFAULT_SHEET_ID, '傳道區域回報!A2:F')
    cache = { at: Date.now(), rows }
    rows.catch(() => { if (cache?.rows === rows) cache = null })
  }
  return cache.rows
}

// GET /api/area-status/history?nos=12,13 — 各區最近三次回報的結束日與回報人（ADR-0107）
export async function GET(request: Request) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const nos = [...new Set((new URL(request.url).searchParams.get('nos') || '').split(',').map(Number))]
  if (!nos.length || nos.length > 10 || nos.some(no => !Number.isInteger(no) || no < 1 || no > 213)) return NextResponse.json({ error: '區域號碼須為 1–213' }, { status: 400 })
  try {
    return NextResponse.json({ history: recentReports(await reportRows(), nos) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '暫時無法讀取回報紀錄' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
