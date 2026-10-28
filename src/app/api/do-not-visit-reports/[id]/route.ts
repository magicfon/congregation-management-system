import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { mergeDoNotVisit, writeBackDoNotVisit } from '../../../../lib/do-not-visit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/do-not-visit-reports/[id] — 管理員核准／不採用回報的拒絕拜訪地址（ADR-0083）
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !['approve', 'reject'].includes(body.action)) return NextResponse.json({ error: '操作無效' }, { status: 400 })
  try {
    const now = new Date()
    const outcome = await prisma.$transaction(async tx => {
      const report = await tx.doNotVisitReport.findUnique({ where: { id: params.id }, include: { area: { select: { id: true, sheetNo: true, doNotVisit: true } } } })
      if (!report) return { status: 404 as const, error: '找不到這筆回報' }
      const reviewed = await tx.doNotVisitReport.updateMany({ where: { id: report.id, status: 'pending' }, data: { status: body.action === 'approve' ? 'approved' : 'rejected', reviewedAt: now, reviewedBy: auth.user.id } })
      if (reviewed.count !== 1) return { status: 409 as const, error: '這筆回報已處理過' }
      if (body.action === 'reject') return { status: 200 as const }
      const text = mergeDoNotVisit(report.area.doNotVisit, report.address)
      const updated = await tx.area.updateMany({ where: { id: report.area.id, doNotVisit: report.area.doNotVisit }, data: { doNotVisit: text } })
      if (updated.count !== 1) throw new Error('conflict')
      return { status: 200 as const, sheetNo: report.area.sheetNo, text }
    })
    if (outcome.status !== 200) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
    const warning = 'text' in outcome ? await writeBackDoNotVisit(prisma, outcome.sheetNo ?? null, outcome.text!) : ''
    return NextResponse.json({ ok: true, warning })
  } catch (error) {
    if (error instanceof Error && error.message === 'conflict') return NextResponse.json({ error: '這張地圖的拒絕拜訪剛被修改，請重新整理後再試' }, { status: 409 })
    console.error('POST /api/do-not-visit-reports error:', error)
    return NextResponse.json({ error: '處理失敗，請稍後再試' }, { status: 503 })
  }
}
