import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { botSite, lineBotReady } from './line-bot-client'
import { configuredLiffId, liffDestination } from './liff-settings'

// 雙頁標籤選單（ADR-0107）：一般頁所有人相同。姊妹版沒有標籤列，是官方帳號預設選單；
// 弟兄與管理者另外綁到個人，上方「一般｜管理」標籤在 LINE 內用 alias 切換，管理頁內容不同。
export type MenuKind = 'sister' | 'brother' | 'admin'
export type MenuKey = 'sister' | 'brother-general' | 'brother-manage' | 'admin-general' | 'admin-manage'
export const menuKeys: MenuKey[] = ['sister', 'brother-general', 'brother-manage', 'admin-general', 'admin-manage']
const tabbedKeys = menuKeys.filter(key => key !== 'sister') as Exclude<MenuKey, 'sister'>[]
const liffId = configuredLiffId()
const stateKey = (key: MenuKey) => liffId ? `line_rich_menu_v6_${key}_liff_${liffId}` : `line_rich_menu_v6_${key}`
// Alias ids are per channel: [a-z0-9_-], at most 32 characters.
export const aliasId = (key: MenuKey) => `cms-v6-${key}`
const menuUrl = (view: string) => liffId ? `https://liff.line.me/${liffId}/?view=${view}` : `${botSite}${liffDestination(view)}`
const lockKey = 'line_rich_menu_publish_lock'
const api = 'https://api.line.me/v2/bot'
const dataApi = 'https://api-data.line.me/v2/bot'
const uri = (view: string) => ({ type: 'uri' as const, uri: menuUrl(view) })
const tiles: Record<string, { type: 'uri'; uri: string } | { type: 'message'; text: string }> = {
  bulletin: uri('bulletin'), dashboard: uri('dashboard'), assignments: { type: 'message', text: '我的委派' }, territory: uri('territory'),
  report: uri('report'), handoffs: uri('handoffs'), schedules: uri('schedules'), myRequests: uri('requests'),
  allocation: uri('territory'), requests: uri('requests'), roster: uri('roster'), midweek: uri('midweek'), announcements: uri('announcements'), members: uri('members'),
}
// Same rows and sizes as scripts/create-line-menu.cjs, which draws the images.
const general = [['bulletin', 'dashboard'], ['assignments', 'territory']]
const layouts: Record<MenuKey, { width: number; height: number; label: string; tab: 'general' | 'manage' | null; rows: string[][] }> = {
  sister: { width: 1000, height: 674, label: '一般', tab: null, rows: general },
  'brother-general': { width: 1332, height: 900, label: '弟兄一般', tab: 'general', rows: general },
  'brother-manage': { width: 1332, height: 900, label: '弟兄管理', tab: 'manage', rows: [['report', 'handoffs'], ['schedules', 'myRequests']] },
  'admin-general': { width: 1332, height: 900, label: '管理者一般', tab: 'general', rows: general },
  'admin-manage': { width: 1332, height: 900, label: '管理者管理', tab: 'manage', rows: [['report', 'handoffs', 'allocation', 'requests'], ['roster', 'midweek', 'announcements', 'members']] },
}
const BAR = 110
function definition(key: MenuKey) {
  const { width, height, label, tab, rows } = layouts[key]
  const top = tab ? BAR : 0, rowH = Math.floor((height - top) / rows.length)
  const role = key.split('-')[0]
  const tabAreas = tab ? (['general', 'manage'] as const).map((target, i) => ({
    bounds: { x: i * (width / 2), y: 0, width: width / 2, height: BAR },
    action: { type: 'richmenuswitch' as const, richMenuAliasId: aliasId(`${role}-${target}` as MenuKey), data: `richmenu-tab=${target}` },
  })) : []
  return {
    size: { width, height }, selected: true,
    name: `楠梓會眾${label}選單 v6`, chatBarText: '開啟功能選單',
    areas: [...tabAreas, ...rows.flatMap((keys, row) => {
      const cell = Math.floor(width / keys.length), y = top + row * rowH
      return keys.map((name, i) => ({
        bounds: { x: i * cell, y, width: i === keys.length - 1 ? width - i * cell : cell, height: row === rows.length - 1 ? height - y : rowH },
        action: tiles[name],
      }))
    })],
  }
}
export const menuDefinitions = Object.fromEntries(menuKeys.map(key => [key, definition(key)])) as Record<MenuKey, ReturnType<typeof definition>>
const imagePath = (key: MenuKey) => path.join(process.cwd(), 'public', 'line', `rich-menu-${key}.png`)
const entryMenu = (kind: MenuKind): MenuKey => kind === 'sister' ? 'sister' : `${kind}-general`

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
async function savedMenus(db: PrismaClient): Promise<Record<MenuKey, string | null>> {
  const rows = await db.setting.findMany({ where: { key: { in: menuKeys.map(stateKey) } } })
  return Object.fromEntries(menuKeys.map(key => [key, rows.find(row => row.key === stateKey(key))?.value || null])) as Record<MenuKey, string | null>
}
export async function richMenuStatus(db: PrismaClient) {
  if (!lineBotReady()) return { enabled: false, currentId: null, installed: false }
  const [currentId, ids] = await Promise.all([currentDefault(), savedMenus(db)])
  return { enabled: true, currentId, installed: menuKeys.every(key => ids[key]) && currentId === ids.sister }
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

async function ensureMenu(db: PrismaClient, key: MenuKey, saved: string | null) {
  let id = saved
  if (id && (await request(`${api}/richmenu/${encodeURIComponent(id)}`)).status === 404) id = null
  if (!id) {
    const image = await readFile(imagePath(key))
    if (image.length > 1000000) throw new RichMenuError('選單圖片超出 LINE 大小限制')
    const created = await request(`${api}/richmenu`, 'POST', JSON.stringify(menuDefinitions[key]), 'application/json')
    if (!created.ok) throw new RichMenuError('無法建立 LINE 選單')
    id = (await created.json()).richMenuId as string
    if (!/^richmenu-[0-9a-f]{32}$/i.test(id)) throw new RichMenuError('LINE 選單回應格式錯誤')
    await db.setting.upsert({ where: { key: stateKey(key) }, create: { key: stateKey(key), value: id }, update: { value: id } })
  }
  // A prior upload may have succeeded even when its response was lost.
  const content = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`)
  await content.body?.cancel()
  if (content.status === 404) {
    const image = await readFile(imagePath(key))
    const uploaded = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`, 'POST', new Uint8Array(image), 'image/png')
    if (!uploaded.ok) throw new RichMenuError('無法上傳 LINE 選單圖片')
  }
  return id
}

async function ensureAlias(key: MenuKey, richMenuId: string) {
  const existing = await request(`${api}/richmenu/alias/${aliasId(key)}`)
  if (existing.status === 404) {
    const created = await request(`${api}/richmenu/alias`, 'POST', JSON.stringify({ richMenuAliasId: aliasId(key), richMenuId }), 'application/json')
    if (!created.ok) throw new RichMenuError('無法建立 LINE 選單分頁')
  } else if ((await existing.json()).richMenuId !== richMenuId) {
    const updated = await request(`${api}/richmenu/alias/${aliasId(key)}`, 'POST', JSON.stringify({ richMenuId }), 'application/json')
    if (!updated.ok) throw new RichMenuError('無法更新 LINE 選單分頁')
  }
}

// 發布：建立五個選單與分頁 alias、姊妹版設為預設，再把現有弟兄與管理者綁上各自的一般頁。
export async function publishRichMenu(db: PrismaClient, expectedCurrentId: string | null) {
  if (!lineBotReady()) throw new RichMenuError('請先完成 LINE Bot 設定', 409)
  const lock = await acquireLock(db)
  try {
    const currentId = await currentDefault()
    if (currentId !== expectedCurrentId) throw new RichMenuError('LINE 預設選單已變更，請重新整理後確認', 409)
    const saved = await savedMenus(db)
    const ids = {} as Record<MenuKey, string>
    for (const key of menuKeys) ids[key] = await ensureMenu(db, key, saved[key])
    for (const key of tabbedKeys) await ensureAlias(key, ids[key])
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
        const bulk = await request(`${api}/richmenu/bulk/link`, 'POST', JSON.stringify({ richMenuId: ids[entryMenu(kind)], userIds: chunk }), 'application/json')
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
    if (!menuKeys.every(key => ids[key])) return
    const members = await db.member.findMany({ where: { lineuid: { in: unique } }, select: { lineuid: true, role: true, gender: true, active: true, deletedAt: true } })
    const results = await Promise.allSettled(unique.map(uid => {
      const kind = memberMenuKind(members.find(member => member.lineuid === uid) ?? null)
      return kind === 'sister'
        ? request(`${api}/user/${encodeURIComponent(uid)}/richmenu`, 'DELETE')
        : request(`${api}/user/${encodeURIComponent(uid)}/richmenu/${encodeURIComponent(ids[entryMenu(kind)]!)}`, 'POST')
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
