import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { decideMapRequest, requestError } from '../../../../lib/map-requests'
import { readSnapshot, pushAreaCDBatch, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'
export const maxDuration = 60
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null), action = body?.action
  if (!['approve', 'reject', 'cancel'].includes(action)) return NextResponse.json({ error: '審核操作無效' }, { status: 400 })
  if (action !== 'cancel' && auth.user.role !== 'admin') return NextResponse.json({ error: '僅管理員可以審核' }, { status: 403 })
  try {
    if (action === 'approve') {
      const snapshot = await readSnapshot()
      if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some(no => !snapshot.has(no))) return NextResponse.json({ error: '同步快照不完整，本次尚未核准或分發' }, { status: 503 })
    }
    const result = await decideMapRequest(prisma, params.id, { id: auth.user.id!, isAdmin: auth.user.role === 'admin' }, action)
    if (!result) return NextResponse.json({ ok: true })
    let sheetSynced = false
    try {
      const items = result.areas.filter(a => a.sheetNo !== null).map(a => ({ sheetNo: a.sheetNo!, memberName: result.member.name, dispatchedAt: result.dispatchedAt }))
      await pushAreaCDBatch(DEFAULT_SHEET_ID, items)
      await updateSnapshot(items.map(i => ({ sheetNo: i.sheetNo, member: i.memberName, date: i.dispatchedAt })))
      sheetSynced = items.length === result.count
    } catch { /* The database is committed; cron can finish the Sheet sync. */ }
    return NextResponse.json({ ok: true, assigned: result.count, sheetSynced })
  } catch (error) { const message = requestError(error); return NextResponse.json({ error: message || '處理失敗，請重新整理確認結果後再試' }, { status: message ? 409 : 500 }) }
}
