import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rosterSnapshot } from '@/lib/service-roster-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { return NextResponse.json(await rosterSnapshot(prisma), { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: '服務安排暫時無法讀取，請重試' }, { status: 503 }) }
}
