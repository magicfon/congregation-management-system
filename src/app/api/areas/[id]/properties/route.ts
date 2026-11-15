import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'
import { isAreaDispatched } from '../../../../../lib/allocation'
import { pushAreaCD, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../../lib/google-sheets'
import { normalizeDoNotVisit, writeBackDoNotVisit, MAX_DO_NOT_VISIT_TEXT } from '../../../../../lib/do-not-visit'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const area = await prisma.area.findUnique({ where: { id: params.id }, select: { id: true, name: true, personalTerritory: true, personalManaged: true, dispatchEnabled: true, doNotVisit: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, assignedMember: { select: { name: true } } } })
    if (!area) return NextResponse.json({ error: '地圖不存在' }, { status: 404 })
    const held = isAreaDispatched(area)
    return NextResponse.json({ id: area.id, name: area.name, personalTerritory: area.personalTerritory, personalManaged: area.personalManaged, dispatchEnabled: area.dispatchEnabled, doNotVisit: area.doNotVisit, holderId: held ? area.assignedMemberId : null, holder: held ? area.assignedMember?.name || '' : null }, { headers: { 'Cache-Control': 'no-store' } })
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
  // 區域分類：一般／個人區域／個人管理（ADR-0036、ADR-0130）
  if (body && 'category' in body) {
    const categories = ['general', 'personal', 'managed']
    if (!categories.includes(body.category) || !categories.includes(body.expectedCategory) || 'dispatchEnabled' in body) return NextResponse.json({ error: '分類設定格式錯誤' }, { status: 400 })
    if (body.category === 'managed' && typeof body.memberId !== 'string') return NextResponse.json({ error: '請選擇管理人' }, { status: 400 })
    try {
      const result = await prisma.$transaction(async tx => {
        const area = await tx.area.findUnique({ where: { id: params.id }, include: { assignedMember: { select: { name: true } } } })
        const current = area?.personalManaged ? 'managed' : area?.personalTerritory ? 'personal' : 'general'
        if (!area || current !== body.expectedCategory || (current === 'managed' && body.category === 'managed' && area.assignedMemberId === body.memberId)) return { conflict: '地圖已被修改或不存在，請重新載入後再試' }
        if (body.category !== 'managed') {
          await tx.area.update({ where: { id: area.id }, data: { personalTerritory: body.category === 'personal', personalManaged: false } })
          return { sheet: null }
        }
        const member = await tx.member.findFirst({ where: { id: body.memberId, active: true, deletedAt: null }, select: { id: true, name: true } })
        if (!member) return { conflict: '找不到這位成員，或帳號已停用' }
        const held = isAreaDispatched(area)
        if (held && area.assignedMemberId !== member.id && !area.personalManaged) return { conflict: `目前由 ${area.assignedMember?.name || '其他人'} 領取，請先收回再設為個人管理` }
        // 管理人即持有人：已由他領取就沿用領取日，否則（含更換管理人）以今天為領取日
        const dispatchedAt = held && area.assignedMemberId === member.id && area.dispatchedAt ? area.dispatchedAt : new Date()
        await tx.area.update({ where: { id: area.id }, data: { personalManaged: true, personalTerritory: false, assignedMemberId: member.id, assignedTo: member.name, dispatchedAt, completedAt: null, dispatchUndo: Prisma.DbNull, lastActivityAt: new Date() } })
        await tx.mapRequest.updateMany({ where: { areaId: area.id, status: 'pending' }, data: { status: 'rejected', reviewedBy: auth.user.id, reviewedAt: new Date() } })
        return { sheet: area.sheetNo ? { sheetNo: area.sheetNo, member: member.name, dispatchedAt } : null }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      if ('conflict' in result) return NextResponse.json({ error: result.conflict }, { status: 409 })
      let warning = ''
      if (result.sheet) {
        try {
          await pushAreaCD(DEFAULT_SHEET_ID, result.sheet.sheetNo, result.sheet.member, result.sheet.dispatchedAt)
          await updateSnapshot([{ sheetNo: result.sheet.sheetNo, member: result.sheet.member, date: result.sheet.dispatchedAt }])
        } catch { warning = '已儲存，區域狀態表稍後會自動同步。' }
      }
      return NextResponse.json({ category: body.category, warning })
    } catch { return NextResponse.json({ error: '分類儲存失敗' }, { status: 500 }) }
  }
  if (typeof body?.dispatchEnabled !== 'boolean' || typeof body?.expectedEnabled !== 'boolean') return NextResponse.json({ error: '分發設定格式錯誤' }, { status: 400 })
  try {
    const updated = await prisma.area.updateMany({ where: { id: params.id, dispatchEnabled: body.expectedEnabled }, data: { dispatchEnabled: body.dispatchEnabled } })
    if (updated.count !== 1) return NextResponse.json({ error: '地圖已被修改或不存在，請重新載入後再試' }, { status: 409 })
    return NextResponse.json({ dispatchEnabled: body.dispatchEnabled })
  } catch { return NextResponse.json({ error: '儲存失敗，請重新載入確認狀態' }, { status: 500 }) }
}
