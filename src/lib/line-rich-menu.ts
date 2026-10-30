import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { botSite, lineBotReady } from './line-bot-client'
import { configuredLiffId, liffDestination } from './liff-settings'

// 三種固定選單（ADR-0102）：姊妹版是官方帳號預設選單，弟兄與管理者另外綁到個人。
export type MenuKind = 'sister' | 'brother' | 'admin'
export const menuKinds: MenuKind[] = ['sister', 'brother', 'admin']
const liffId = configuredLiffId()
const stateKey = (kind: MenuKind) => liffId ? `line_rich_menu_v5_${kind}_liff_${liffId}` : `line_rich_menu_v5_${kind}`
const menuUrl = (view: string) => liffId ? `https://liff.line.me/${liffId}/?view=${view}` : `${botSite}${liffDestination(view)}`
const lockKey = 'line_rich_menu_publish_lock'
const api = 'https://api.line.me/v2/bot'
const dataApi = 'https://api-data.line.me/v2/bot'
const tiles: Record<string, { type: 'uri'; uri: string } | { type: 'message'; text: string }> = {
  bulletin: { type: 'uri', uri: menuUrl('bulletin') },
  dashboard: { type: 'uri', uri: menuUrl('dashboard') },
  assignments: { type: 'message', text: '我的委派' },
  territory: { type: 'uri', uri: menuUrl('territory') },
  handoffs: { type: 'uri', uri: menuUrl('handoffs') },
  report: { type: 'uri', uri: menuUrl('report') },
  manage: { type: 'uri', uri: menuUrl('manage') },
}
// Same rows as scripts/create-line-menu.cjs, which draws the images.
const layouts: Record<MenuKind, { width: number; label: string; rows: string[][] }> = {
  sister: { width: 1000, label: '姊妹', rows: [['bulletin', 'dashboard'], ['assignments', 'territory']] },
  brother: { width: 999, label: '弟兄', rows: [['bulletin', 'dashboard', 'assignments'], ['territory', 'handoffs', 'report']] },
  admin: { width: 1332, label: '管理者', rows: [['bulletin', 'dashboard', 'assignments', 'territory'], ['handoffs', 'report', 'manage']] },
}
function definition(kind: MenuKind) {
  const { width, label, rows } = layouts[kind]
  return {
    size: { width, height: 674 }, selected: true,
    name: `楠梓會眾${label}選單 v5`, chatBarText: '開啟功能選單',
    areas: rows.flatMap((keys, row) => {
      const cell = Math.floor(width / keys.length)
      return keys.map((key, i) => ({ bounds: { x: i * cell, y: row * 337, width: i === keys.length - 1 ? width - i * cell : cell, height: 337 }, action: tiles[key] }))
    }),
  }
}
export const menuDefinitions = Object.fromEntries(menuKinds.map(kind => [kind, definition(kind)])) as Record<MenuKind, ReturnType<typeof definition>>
const imagePath = (kind: MenuKind) => path.join(process.cwd(), 'public', 'line', `rich-menu-${kind}.png`)

// 未設性別、停用、刪除或未連結的人都看預設的姊妹版。
export function memberMenuKind(member: { role: string; gender: string; active: boolean; deletedAt: Date | null } | null): MenuKind {
  if (!member?.active || member.deletedAt) return 'sister'
  return member.role === 'admin' ? 'admin' : member.gender === 'brother' ? 'brother' : 'sister'
}
export class RichMenuError extends Error {
  constructor(message: string, public status = 503) { super(message) }
}
async function request(url: string, method = 'GET', body?: BodyInit, contentType?: string) {
  const response = await fetch(url, {
    method, headers: { Authorization: `Bearer ${process.env.LINE_BOT_ACCESS_TOKEN}`, ...(contentType ? { 'Content-Type': contentType } : {}) },
    body, cache: 'no-store', signal: AbortSignal.timeout(8000),
  })
  if (!response.ok && response.status !== 404) throw new RichMenuError(`LINE 選單操作失敗（HTTP ${response.status}），請檢查 Bot 憑證或稍後重試`)
  return response
}
async function currentDefault(): Promise<string | null> {
  const response = await request(`${api}/user/all/richmenu`)
  if (response.status === 404) return null
  return (await response.json()).richMenuId
}
async function savedMenus(db: PrismaClient): Promise<Record<MenuKind, string | null>> {
  const rows = await db.setting.findMany({ where: { key: { in: menuKinds.map(stateKey) } } })
  return Object.fromEntries(menuKinds.map(kind => [kind, rows.find(row => row.key === stateKey(kind))?.value || null])) as Record<MenuKind, string | null>
}
export async function richMenuStatus(db: PrismaClient) {
  if (!lineBotReady()) return { enabled: false, currentId: null, installed: false }
  const [currentId, ids] = await Promise.all([currentDefault(), savedMenus(db)])
  return { enabled: true, currentId, installed: menuKinds.every(kind => ids[kind]) && currentId === ids.sister }
}

async function acquireLock(db: PrismaClient) {
  const value = `${Date.now() + 120000}:${randomUUID()}`
  const existing = await db.setting.findUnique({ where: { key: lockKey } })
  if (existing) {
    if (Number(existing.value.split(':')[0]) > Date.now()) throw new RichMenuError('選單正在發布，請稍後重新整理', 409)
    const updated = await db.setting.updateMany({ where: { key: lockKey, value: existing.value }, data: { value } })
    if (!updated.count) throw new RichMenuError('選單正在發布，請稍後重新整理', 409)
  } else {
    try { await db.setting.create({ data: { key: lockKey, value } }) }
    catch { throw new RichMenuError('暫時無法取得發布鎖，請稍後重試', 409) }
  }
  return value
}

async function ensureMenu(db: PrismaClient, kind: MenuKind, saved: string | null) {
  let id = saved
  if (id && (await request(`${api}/richmenu/${encodeURIComponent(id)}`)).status === 404) id = null
  if (!id) {
    const image = await readFile(imagePath(kind))
    if (image.length > 1000000) throw new RichMenuError('選單圖片超出 LINE 大小限制')
    const created = await request(`${api}/richmenu`, 'POST', JSON.stringify(menuDefinitions[kind]), 'application/json')
    if (!created.ok) throw new RichMenuError('無法建立 LINE 選單')
    id = (await created.json()).richMenuId as string
    if (!/^richmenu-[0-9a-f]{32}$/i.test(id)) throw new RichMenuError('LINE 選單回應格式錯誤')
    await db.setting.upsert({ where: { key: stateKey(kind) }, create: { key: stateKey(kind), value: id }, update: { value: id } })
  }
  // A prior upload may have succeeded even when its response was lost.
  const content = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`)
  await content.body?.cancel()
  if (content.status === 404) {
    const image = await readFile(imagePath(kind))
    const uploaded = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`, 'POST', new Uint8Array(image), 'image/png')
    if (!uploaded.ok) throw new RichMenuError('無法上傳 LINE 選單圖片')
  }
  return id
}

// 發布：建立三種選單、姊妹版設為預設，再把現有弟兄與管理者綁上各自的選單。
export async function publishRichMenu(db: PrismaClient, expectedCurrentId: string | null) {
  if (!lineBotReady()) throw new RichMenuError('請先完成 LINE Bot 設定', 409)
  const lock = await acquireLock(db)
  try {
    const currentId = await currentDefault()
    if (currentId !== expectedCurrentId) throw new RichMenuError('LINE 預設選單已變更，請重新整理後確認', 409)
    const saved = await savedMenus(db)
    const ids = {} as Record<MenuKind, string>
    for (const kind of menuKinds) ids[kind] = await ensureMenu(db, kind, saved[kind])
    const latest = await currentDefault()
    if (latest !== expectedCurrentId && latest !== ids.sister) throw new RichMenuError('LINE 預設選單已變更，請重新整理後確認', 409)
    if (latest !== ids.sister) {
      const published = await request(`${api}/user/all/richmenu/${encodeURIComponent(ids.sister)}`, 'POST')
      if (!published.ok) throw new RichMenuError('無法設定 LINE 預設選單')
    }
    if (await currentDefault() !== ids.sister) throw new RichMenuError('尚未確認 LINE 選單發布結果，請重新整理')
    const members = await db.member.findMany({ where: { lineuid: { not: null }, active: true, deletedAt: null }, select: { lineuid: true, role: true, gender: true, active: true, deletedAt: true } })
    const linked = { brother: 0, admin: 0 }
    for (const kind of ['brother', 'admin'] as const) {
      const userIds = members.filter(member => memberMenuKind(member) === kind).map(member => member.lineuid!)
      for (let i = 0; i < userIds.length; i += 500) {
        const chunk = userIds.slice(i, i + 500)
        const bulk = await request(`${api}/richmenu/bulk/link`, 'POST', JSON.stringify({ richMenuId: ids[kind], userIds: chunk }), 'application/json')
        if (!bulk.ok) throw new RichMenuError('預設選單已發布，但弟兄／管理者選單綁定失敗，請重新整理後重試')
        linked[kind] += chunk.length
      }
    }
    return { installed: true, currentId: ids.sister, linked }
  } finally {
    await db.setting.deleteMany({ where: { key: lockKey, value: lock } }).catch(() => {})
  }
}

// 權限、性別、LINE 連結或帳號狀態改變後呼叫；選單尚未發布時不動作，失敗只記錄不擋原操作。
export async function syncMemberRichMenus(db: PrismaClient, uids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(uids.filter((uid): uid is string => !!uid)))
  if (!unique.length || !lineBotReady()) return
  try {
    const ids = await savedMenus(db)
    if (!menuKinds.every(kind => ids[kind])) return
    const members = await db.member.findMany({ where: { lineuid: { in: unique } }, select: { lineuid: true, role: true, gender: true, active: true, deletedAt: true } })
    const results = await Promise.allSettled(unique.map(uid => {
      const kind = memberMenuKind(members.find(member => member.lineuid === uid) ?? null)
      return kind === 'sister'
        ? request(`${api}/user/${encodeURIComponent(uid)}/richmenu`, 'DELETE')
        : request(`${api}/user/${encodeURIComponent(uid)}/richmenu/${encodeURIComponent(ids[kind]!)}`, 'POST')
    }))
    const failed = results.filter(result => result.status === 'rejected').length
    if (failed) console.error(`LINE rich menu sync failed for ${failed} of ${unique.length} users`)
  } catch (error) {
    console.error('LINE rich menu sync failed:', error)
  }
}
export async function syncMemberRichMenusById(db: PrismaClient, memberIds: string[]) {
  if (!memberIds.length || !lineBotReady()) return
  try {
    const members = await db.member.findMany({ where: { id: { in: memberIds } }, select: { lineuid: true } })
    await syncMemberRichMenus(db, members.map(member => member.lineuid))
  } catch (error) {
    console.error('LINE rich menu sync failed:', error)
  }
}
