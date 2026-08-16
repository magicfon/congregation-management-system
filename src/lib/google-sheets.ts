/**
 * Google Sheets REST client（無 googleapis 依賴）
 *
 * 環境變數：
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
 *   GOOGLE_SHEET_ID（選，預設傳道區域回報 spreadsheet）
 *
 * 註：刻意不用 googleapis Node library——其 refresh 流程與現行
 * OAuth token 不相容（invalid_request），REST + 手動 refresh 已驗證可用。
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

let cachedToken: { token: string; expiry: number } | null = null

export const DEFAULT_SHEET_ID =
  process.env.GOOGLE_SHEET_ID || '1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU'

/** 台北時區 yyyy-mm-dd（不可用 toISOString——UTC 會讓台北日期倒退一天） */
export function taipeiDate(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiry > Date.now() + 60_000) return cachedToken.token

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN env')
  }

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!resp.ok) throw new Error(`Google token refresh failed: ${resp.status} ${await resp.text()}`)
  const data = await resp.json()
  cachedToken = { token: data.access_token, expiry: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedToken.token
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown) {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : `${SHEETS_API}/${path}`
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Sheets API ${method} ${path} failed: ${resp.status} ${text.slice(0, 300)}`)
  }
  return resp.json()
}

/** 讀值。range 例：'區域狀態!A1:G214' */
export async function readValues(sheetId: string, range: string): Promise<string[][]> {
  const data = await call('GET', `${sheetId}/values/${encodeURIComponent(range)}`)
  return data.values || []
}

/**
 * 寫值（單列 C/D 更新用）。
 * range 例：'區域狀態!C5:D5'，values 例：[['宮西真悟','2026-08-16']]
 */
export async function updateValues(
  sheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> {
  await call('POST', `${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    values,
  })
}

/** 批次多範圍寫入 */
export async function batchUpdate(
  sheetId: string,
  data: { range: string; values: (string | number)[][] }[]
): Promise<void> {
  await call('POST', `${sheetId}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: data.map(d => ({ range: d.range, values: d.values })),
  })
}

// ---------- 領域專用 helpers ----------

/** 區域號碼 →「區域狀態」列號（R1 是標題，sheetNo 1 在 R2） */
export function sheetRow(sheetNo: number): number {
  return sheetNo + 1
}

/** DB → Sheet：更新某區域的 C（負責弟兄）/ D（分發日期）欄 */
export async function pushAreaCD(
  sheetId: string,
  sheetNo: number,
  memberName: string | null,
  dispatchedAt: Date | null
): Promise<void> {
  const row = sheetRow(sheetNo)
  const c = memberName || ''
  const d = taipeiDate(dispatchedAt)
  await updateValues(sheetId, `區域狀態!C${row}:D${row}`, [[c, d]])
}

/** DB → Sheet：批次更新多個區域的 C/D 欄 */
export async function pushAreaCDBatch(
  sheetId: string,
  items: { sheetNo: number; memberName: string | null; dispatchedAt: Date | null }[]
): Promise<void> {
  if (items.length === 0) return
  await batchUpdate(
    sheetId,
    items.map(it => {
      const row = sheetRow(it.sheetNo)
      return {
        range: `區域狀態!C${row}:D${row}`,
        values: [[it.memberName || '', taipeiDate(it.dispatchedAt)]],
      }
    })
  )
}

// ---------- 同步快照（衝突比對用） ----------
// 快照記錄「上次同步時的 C/D 狀態」。Sheet 與快照不同 → 有人改了 Sheet。

export type CdSnapshotEntry = {
  sheetNo: number
  member: string
  date: string // yyyy-mm-dd or ''
}

/**
 * 更新快照（部分區域）。keepDate: true 時保留快照中現有日期（收回場景 D 欄不動）。
 */
export async function updateSnapshot(
  updates: { sheetNo: number; member: string; date: Date | null; keepDate?: boolean }[]
): Promise<void> {
  // 動態 import 避免循環依賴
  const { prisma } = await import('./db')
  const setting = await prisma.setting.findUnique({ where: { key: 'sheet_cd_snapshot' } })
  const snap: CdSnapshotEntry[] = setting ? JSON.parse(setting.value) : []
  const map = new Map(snap.map(e => [e.sheetNo, e]))

  for (const u of updates) {
    const prev = map.get(u.sheetNo)
    map.set(u.sheetNo, {
      sheetNo: u.sheetNo,
      member: u.member,
      date: u.keepDate
        ? prev?.date || ''
        : taipeiDate(u.date),
    })
  }
  const next = Array.from(map.values()).sort((a, b) => a.sheetNo - b.sheetNo)
  await prisma.setting.upsert({
    where: { key: 'sheet_cd_snapshot' },
    create: { key: 'sheet_cd_snapshot', value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })
}

export async function readSnapshot(): Promise<Map<number, CdSnapshotEntry>> {
  const { prisma } = await import('./db')
  const setting = await prisma.setting.findUnique({ where: { key: 'sheet_cd_snapshot' } })
  if (!setting) return new Map()
  const snap: CdSnapshotEntry[] = JSON.parse(setting.value)
  return new Map(snap.map(e => [e.sheetNo, e]))
}
