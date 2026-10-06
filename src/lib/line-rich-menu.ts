import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { botSite, lineBotReady } from './line-bot-client'

const stateKey = 'line_rich_menu_v2'
const lockKey = 'line_rich_menu_publish_lock'
const api = 'https://api.line.me/v2/bot'
const dataApi = 'https://api-data.line.me/v2/bot'
export const menuDefinition = {
  size: { width: 1000, height: 674 }, selected: true,
  name: '楠梓會眾功能選單 v2', chatBarText: '開啟功能選單',
  areas: [
    { bounds: { x: 0, y: 0, width: 500, height: 337 }, action: { type: 'uri', uri: `${botSite}/dashboard?view=maps` } },
    { bounds: { x: 500, y: 0, width: 500, height: 337 }, action: { type: 'uri', uri: `${botSite}/dashboard?view=week` } },
    { bounds: { x: 0, y: 337, width: 500, height: 337 }, action: { type: 'uri', uri: `${botSite}/dashboard?view=handoffs` } },
    { bounds: { x: 500, y: 337, width: 500, height: 337 }, action: { type: 'uri', uri: `${botSite}/bulletin` } },
  ],
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
async function savedMenu(db: PrismaClient): Promise<string | null> {
  const saved = await db.setting.findUnique({ where: { key: stateKey } })
  return saved?.value || null
}
export async function richMenuStatus(db: PrismaClient) {
  if (!lineBotReady()) return { enabled: false, currentId: null, installed: false }
  const [currentId, ownedId] = await Promise.all([currentDefault(), savedMenu(db)])
  return { enabled: true, currentId, installed: !!ownedId && currentId === ownedId }
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

export async function publishRichMenu(db: PrismaClient, expectedCurrentId: string | null) {
  if (!lineBotReady()) throw new RichMenuError('請先完成 LINE Bot 設定', 409)
  const lock = await acquireLock(db)
  try {
    const currentId = await currentDefault()
    if (currentId !== expectedCurrentId) throw new RichMenuError('LINE 預設選單已變更，請重新整理後確認', 409)
    let id = await savedMenu(db)
    if (id && (await request(`${api}/richmenu/${encodeURIComponent(id)}`)).status === 404) id = null
    if (!id) {
      const image = await readFile(path.join(process.cwd(), 'public', 'line', 'rich-menu-v1.png'))
      if (image.length > 1000000) throw new RichMenuError('選單圖片超出 LINE 大小限制')
      const created = await request(`${api}/richmenu`, 'POST', JSON.stringify(menuDefinition), 'application/json')
      if (!created.ok) throw new RichMenuError('無法建立 LINE 選單')
      id = (await created.json()).richMenuId as string
      if (!/^richmenu-[0-9a-f]{32}$/i.test(id)) throw new RichMenuError('LINE 選單回應格式錯誤')
      await db.setting.upsert({ where: { key: stateKey }, create: { key: stateKey, value: id }, update: { value: id } })
    }
    // A prior upload may have succeeded even when its response was lost.
    const content = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`)
    await content.body?.cancel()
    if (content.status === 404) {
      const image = await readFile(path.join(process.cwd(), 'public', 'line', 'rich-menu-v1.png'))
      const uploaded = await request(`${dataApi}/richmenu/${encodeURIComponent(id)}/content`, 'POST', new Uint8Array(image), 'image/png')
      if (!uploaded.ok) throw new RichMenuError('無法上傳 LINE 選單圖片')
    }
    const latest = await currentDefault()
    if (latest !== expectedCurrentId && latest !== id) throw new RichMenuError('LINE 預設選單已變更，請重新整理後確認', 409)
    if (latest !== id) {
      const published = await request(`${api}/user/all/richmenu/${encodeURIComponent(id)}`, 'POST')
      if (!published.ok) throw new RichMenuError('無法設定 LINE 預設選單')
    }
    if (await currentDefault() !== id) throw new RichMenuError('尚未確認 LINE 選單發布結果，請重新整理')
    return { installed: true, currentId: id }
  } finally {
    await db.setting.deleteMany({ where: { key: lockKey, value: lock } }).catch(() => {})
  }
}
