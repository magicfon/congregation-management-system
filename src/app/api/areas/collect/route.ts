import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { updateValues, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'

// POST /api/areas/collect — batch collect (return) areas from members
// Admin only. Sets completedAt = now() (isDispatched 變 false；assignedMemberId 保留作歷史)。
// Sheet 端同步：C 欄清空、D 欄保留。
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const { areaIds } = await request.json() as { areaIds: string[] }

    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json({ error: '缺少 areaIds' }, { status: 400 })
    }

    const now = new Date()

    const areas = await prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, sheetNo: true } })

    // Batch update: set completedAt and clear assignment
    const result = await prisma.area.updateMany({
      where: { id: { in: areaIds } },
      data: {
        completedAt: now,
        lastActivityAt: now,
      },
    })

    // DB → Sheet 即時推送：清 C、D 保留（fire-and-forget，失敗靠 cron 補救）
    void (async () => {
      for (const a of areas) {
        if (!a.sheetNo) continue
        try {
          await updateValues(DEFAULT_SHEET_ID, `區域狀態!C${a.sheetNo + 1}:C${a.sheetNo + 1}`, [['']])
          await updateSnapshot([{ sheetNo: a.sheetNo, member: '', date: null, keepDate: true }])
        } catch (e) {
          console.error('collect pushToSheet failed (cron 會補救):', e)
        }
      }
    })()

    return NextResponse.json({
      collected: result.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('POST /api/areas/collect error:', error)
    return NextResponse.json({ error: '收回失敗' }, { status: 500 })
  }
}
