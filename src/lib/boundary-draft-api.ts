import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './db'
import { boundaryMapId, validateBoundarySave } from './boundary-drafts'

type DraftRow = { mapId: string; document: unknown; version: number; updatedAt: Date; updatedBy: string }
type Context = { params: { mapId: string } }
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function readBoundaryDraft(_request: NextRequest, { params }: Context) {
  if (!boundaryMapId(params.mapId)) return respond({ error: '未知地圖' }, 404)
  try {
    const rows = await prisma.$queryRaw<DraftRow[]>`SELECT "mapId", "document", "version", "updatedAt" FROM "map_boundary_drafts" WHERE "mapId" = ${params.mapId}`
    const row = rows[0]
    return respond({ draft: row ? { mapId: row.mapId, document: row.document, version: row.version, updatedAt: row.updatedAt } : null })
  } catch {
    return respond({ error: '雲端草稿暫時無法讀取，請保留本機備份；部署需先建立草稿表。' }, 503)
  }
}

export async function writeBoundaryDraft(request: NextRequest, { params }: Context, updatedBy: string) {
  if (!boundaryMapId(params.mapId)) return respond({ error: '未知地圖' }, 404)
  if (!request.headers.get('content-type')?.startsWith('application/json')) return respond({ error: '僅接受 JSON' }, 415)
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return respond({ error: '請從本站儲存' }, 403)
  let save: ReturnType<typeof validateBoundarySave>
  try {
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > 2_000_000) return respond({ error: '草稿超過 2 MB，請先匯出備份' }, 413)
    save = validateBoundarySave(params.mapId, JSON.parse(text))
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : '修正資料無效' }, 400)
  }
  try {
    const { expectedVersion, document } = save
    const serialized = JSON.stringify(document)
    // A single conditional SQL statement owns the version check and write.
    // Concurrent first saves cannot both create; stale updates cannot overwrite.
    const rows = expectedVersion === 0
      ? await prisma.$queryRaw<DraftRow[]>`INSERT INTO "map_boundary_drafts" ("mapId", "document", "version", "updatedBy", "updatedAt") VALUES (${params.mapId}, ${serialized}::jsonb, 1, ${updatedBy}, CURRENT_TIMESTAMP) ON CONFLICT ("mapId") DO NOTHING RETURNING "mapId", "version", "updatedAt"`
      : await prisma.$queryRaw<DraftRow[]>`UPDATE "map_boundary_drafts" SET "document" = ${serialized}::jsonb, "version" = "version" + 1, "updatedBy" = ${updatedBy}, "updatedAt" = CURRENT_TIMESTAMP WHERE "mapId" = ${params.mapId} AND "version" = ${expectedVersion} RETURNING "mapId", "version", "updatedAt"`
    if (!rows.length) return respond({ error: '其他裝置已更新草稿。請先匯出本機修正，再載入雲端版本重新核對。' }, 409)
    const row = rows[0]
    return respond({ saved: { mapId: row.mapId, version: row.version, updatedAt: row.updatedAt } })
  } catch {
    return respond({ error: '雲端儲存失敗，修正仍保留在本機；請稍後重試或匯出 JSON。' }, 503)
  }
}
