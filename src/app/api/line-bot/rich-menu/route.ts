import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { publishRichMenu, richMenuStatus, RichMenuError } from '../../../../lib/line-rich-menu'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof RichMenuError ? error.message : 'LINE 選單操作暫時失敗，請重新整理後重試' }, { status: error instanceof RichMenuError ? error.status : 503 })
}
async function authorize(request?: NextRequest) {
  if (process.env.CRON_SECRET && request?.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return { user: { role: 'admin' } }
  return requireApiUser(['admin'])
}
export async function GET(request: NextRequest) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response
  try { return NextResponse.json(await richMenuStatus(prisma), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !(body.expectedCurrentId === null || (typeof body.expectedCurrentId === 'string' && /^richmenu-[0-9a-f]{32}$/i.test(body.expectedCurrentId)))) {
    return NextResponse.json({ error: '請先讀取目前選單狀態' }, { status: 400 })
  }
  try { return NextResponse.json(await publishRichMenu(prisma, body.expectedCurrentId)) }
  catch (error) { return failure(error) }
}
