import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'
import { normalizeDoNotVisit, writeBackDoNotVisit, MAX_DO_NOT_VISIT_TEXT } from '../../../../../lib/do-not-visit'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const area = await prisma.area.findUnique({ where: { id: params.id }, select: { id: true, name: true, personalTerritory: true, dispatchEnabled: true, doNotVisit: true } })
    if (!area) return NextResponse.json({ error: '地圖不存在' }, { status: 404 })
    return NextResponse.json(area, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '無法讀取地圖屬性' }, { status: 503 }) }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (body && 'doNotVisit' in body) {
    if (typeof body.doNotVisit !== 'string' || typeof body.expectedDoNotVisit !== 'string') return NextResponse.json({ error: '拒絕拜訪格式錯誤' }, { status: 400 })
    const text = normalizeDoNotVisit(body.doNotVisit)
    if (text.length > MAX_DO_NOT_VISIT_TEXT) return NextResponse.json({ error: `拒絕拜訪最多 ${MAX_DO_NOT_VISIT_TEXT} 字` }, { status: 400 })
    try {
      const area = await prisma.area.findUnique({ where: { id: params.id }, select: { sheetNo: true } })
      const updated = await prisma.area.updateMany({ where: { id: params.id, doNotVisit: body.expectedDoNotVisit }, data: { doNotVisit: text } })
      if (!area || updated.count !== 1) return NextResponse.json({ error: '拒絕拜訪已被修改或地圖不存在，請重新載入後再試' }, { status: 409 })
      return NextResponse.json({ doNotVisit: text, warning: await writeBackDoNotVisit(prisma, area.sheetNo, text) })
    } catch { return NextResponse.json({ error: '拒絕拜訪儲存失敗' }, { status: 500 }) }
  }
  if (body && 'personalTerritory' in body) {
    if (typeof body.personalTerritory !== 'boolean' || typeof body.expectedPersonalTerritory !== 'boolean' || 'dispatchEnabled' in body) return NextResponse.json({ error: '分類設定格式錯誤' }, { status: 400 })
    try {
      const updated = await prisma.area.updateMany({ where: { id: params.id, personalTerritory: body.expectedPersonalTerritory }, data: { personalTerritory: body.personalTerritory } })
      if (updated.count !== 1) return NextResponse.json({ error: '地圖已被修改或不存在，請重新載入後再試' }, { status: 409 })
      return NextResponse.json({ personalTerritory: body.personalTerritory })
    } catch { return NextResponse.json({ error: '分類儲存失敗' }, { status: 500 }) }
  }
  if (typeof body?.dispatchEnabled !== 'boolean' || typeof body?.expectedEnabled !== 'boolean') return NextResponse.json({ error: '分發設定格式錯誤' }, { status: 400 })
  try {
    const updated = await prisma.area.updateMany({ where: { id: params.id, dispatchEnabled: body.expectedEnabled }, data: { dispatchEnabled: body.dispatchEnabled } })
    if (updated.count !== 1) return NextResponse.json({ error: '地圖已被修改或不存在，請重新載入後再試' }, { status: 409 })
    return NextResponse.json({ dispatchEnabled: body.dispatchEnabled })
  } catch { return NextResponse.json({ error: '儲存失敗，請重新載入確認狀態' }, { status: 500 }) }
}
