import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { adminTasks } from '../../../../lib/admin-tasks'

export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json(await adminTasks(prisma), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '待辦資料暫時無法讀取，請重新整理。' }, { status: 503 })
  }
}
