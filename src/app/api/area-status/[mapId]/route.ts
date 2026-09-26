import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { boundaryMapId, boundaryOriginal, validateBoundarySave } from '../../../../lib/boundary-drafts'
import { regionHeat } from '../../../../lib/area-status'
import { taipeiDate } from '../../../../lib/google-sheets'
import { COMPLETION_SYNC_KEY } from '../../../../lib/report-completion-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: { mapId: string } }) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const mapId = params.mapId
  if (!boundaryMapId(mapId)) return NextResponse.json({ error: '未知地圖' }, { status: 404 })
  try {
    const [rows, areas, sync] = await Promise.all([
      prisma.$queryRaw<{ document: unknown; version: number; updatedAt: Date }[]>`SELECT "document", "version", "updatedAt" FROM "map_boundary_drafts" WHERE "mapId" = ${mapId}`,
      prisma.area.findMany({ where: { mapId }, select: { sheetNo: true, name: true, lastReportedCompletedAt: true } }),
      prisma.setting.findUnique({ where: { key: COMPLETION_SYNC_KEY } }),
    ])
    const draft = rows[0], original = boundaryOriginal(mapId)
    const { document } = validateBoundarySave(mapId, { expectedVersion: 0, document: draft?.document ?? original })
    const today = taipeiDate(new Date())
    const completionAreas = areas.map(a => ({ sheetNo: a.sheetNo, name: a.name, lastCompletedDate: taipeiDate(a.lastReportedCompletedAt) || null }))
    const regions = document.candidates.map((c: { candidateId: string; numberCandidates: number[]; polygons: number[][][][]; pixelArea: number }) => ({
      candidateId: c.candidateId, numbers: c.numberCandidates, polygons: c.polygons, pixelArea: c.pixelArea,
      ...regionHeat(c.numberCandidates, completionAreas, today, Boolean(sync?.value)),
    }))
    const located = new Set<number>(regions.flatMap((r: { numbers: number[] }) => r.numbers))
    return NextResponse.json({
      mapId, today, syncedAt: sync?.value || null, sourceImage: original.sourceImage, imageSize: original.imageSize,
      boundary: { source: draft ? 'cloud' : 'original', version: draft?.version ?? null, updatedAt: draft?.updatedAt ?? null },
      regions, unlocatedNumbers: areas.flatMap(a => a.sheetNo !== null && !located.has(a.sheetNo) ? [a.sheetNo] : []).sort((a, b) => a - b),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '無法載入區域狀況，請稍後重試。分區草稿或回報資料尚未取得。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
