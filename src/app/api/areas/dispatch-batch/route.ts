import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { batchDispatch, DispatchConflict } from '../../../../lib/batch-dispatch'
import { readSnapshot, pushAreaCDBatch, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.areaIds) || body.areaIds.length < 1 || body.areaIds.length > 213
    || !body.areaIds.every((id: unknown) => typeof id === 'string' && id.trim())
    || new Set(body.areaIds).size !== body.areaIds.length
    || typeof body.memberId !== 'string' || !body.memberId.trim()
    || (body.note != null && (typeof body.note !== 'string' || body.note.length > 1000))) {
    return NextResponse.json({ error: '請選擇地圖與成員，備註限 1000 字' }, { status: 400 })
  }
  try {
    const snapshot = await readSnapshot()
    if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some((no) => !snapshot.has(no))) {
      return NextResponse.json({ error: '同步快照未涵蓋完整 213 區，請先修復同步狀態；本次未分發。' }, { status: 503 })
    }
    const result = await batchDispatch(prisma, body.areaIds, body.memberId, body.note?.trim() || null)
    let sheetSynced = false
    try {
      const items = result.areas.filter((area) => area.sheetNo !== null).map((area) => ({
        sheetNo: area.sheetNo!, memberName: result.member.name, dispatchedAt: result.dispatchedAt,
      }))
      await pushAreaCDBatch(DEFAULT_SHEET_ID, items)
      await updateSnapshot(items.map((item) => ({ sheetNo: item.sheetNo, member: item.memberName, date: item.dispatchedAt })))
      sheetSynced = items.length === result.count
    } catch (error) { console.error('Batch dispatch Sheet push failed:', error) }
    return NextResponse.json({ assigned: result.count, sheetSynced })
  } catch (error) {
    if (error instanceof DispatchConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: '分配狀態同時被修改，本次未分發，請重新整理後再試' }, { status: 409 })
    }
    console.error('Batch dispatch failed:', error)
    return NextResponse.json({ error: '分發未完成，請重新整理確認地圖狀態' }, { status: 500 })
  }
}
