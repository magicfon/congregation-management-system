import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'
import { undoDispatch, UndoConflict } from '../../../../../lib/dispatch-undo'
import { pushAreaCDBatch, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../../lib/google-sheets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/areas/[id]/undo-dispatch — 派錯人時撤銷派發（管理員）。Sheet C 清空、D 改回派發前的日期。
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (typeof body?.dispatchedAt !== 'string') return NextResponse.json({ error: '缺少派發時間，請重新整理' }, { status: 400 })
  try {
    const result = await undoDispatch(prisma, params.id, body.dispatchedAt)
    let sheetSynced = result.sheetNo === null
    if (result.sheetNo !== null) {
      try {
        await pushAreaCDBatch(DEFAULT_SHEET_ID, [{ sheetNo: result.sheetNo, memberName: null, dispatchedAt: result.previousDispatchedAt }])
        await updateSnapshot([{ sheetNo: result.sheetNo, member: '', date: result.previousDispatchedAt }])
        sheetSynced = true
      } catch (error) { console.error('Undo dispatch Sheet push failed:', error) }
    }
    return NextResponse.json({ undone: true, holder: result.holder, removedVisits: result.removedVisits, sheetSynced })
  } catch (error) {
    if (error instanceof UndoConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return NextResponse.json({ error: '地圖狀態同時被修改，請重新整理後再試' }, { status: 409 })
    console.error('Undo dispatch failed:', error)
    return NextResponse.json({ error: '撤銷派發失敗，請重新整理確認地圖狀態' }, { status: 500 })
  }
}
