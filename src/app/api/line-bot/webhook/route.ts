import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { botText, lineBotReady, lineRequest, verifyLineSignature } from '../../../../lib/line-bot-client'
import { lineBotAnswer } from '../../../../lib/line-bot-queries'
import { acknowledgeNotice, isNoticeAck, studentNoticeSample } from '../../../../lib/student-notice'
import { taipeiDate } from '../../../../lib/google-sheets'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request: NextRequest) {
  if (!lineBotReady()) return NextResponse.json({ error: 'Bot not configured' }, { status: 503 })
  const body = Buffer.from(await request.arrayBuffer())
  if (body.length > 1000000) return new NextResponse(null, { status: 413 })
  if (!verifyLineSignature(body, request.headers.get('x-line-signature'), process.env.LINE_BOT_CHANNEL_SECRET!)) return new NextResponse(null, { status: 401 })
  let payload
  try { payload = JSON.parse(body.toString('utf8')) } catch { return new NextResponse(null, { status: 400 }) }
  if (!Array.isArray(payload?.events) || payload.events.length > 20) return new NextResponse(null, { status: 400 })
  try {
    // Private queries register unknown identities without granting access.
    // Reply tokens are single-use, including redelivery; registration is idempotent.
    for (let offset = 0; offset < payload.events.length; offset += 4) {
      await Promise.all(payload.events.slice(offset, offset + 4).map(async (event: { source?: { type?: string; userId?: string }; replyToken?: string; type?: string; message?: { type?: string; text?: string }; postback?: { data?: string } }) => {
      if (event?.source?.type !== 'user' || typeof event.source.userId !== 'string' || typeof event.replyToken !== 'string') return
      if (event.type === 'postback' && isNoticeAck(event.postback?.data)) {
        const reply = await lineRequest('reply', { replyToken: event.replyToken, messages: [{ type: 'text', text: await acknowledgeNotice(prisma, event.source.userId, event.postback!.data!) }] })
        if (!reply.accepted && reply.status !== 400) throw new Error('LINE reply unavailable')
        return
      }
      if (event.type !== 'follow' && !(event.type === 'message' && event.message?.type === 'text')) return
      const command = event.type === 'follow' ? '選單' : String(event.message?.text || '').trim()
      // 學生練習通知單樣式只給已綁定的管理員預覽（ADR-0090）。
      const admin = command === '通知單樣式' && await prisma.member.findFirst({ where: { lineuid: event.source.userId, active: true, deletedAt: null, role: 'admin' }, select: { id: true } })
      const message = admin ? await studentNoticeSample(prisma, taipeiDate(new Date())) : botText(await lineBotAnswer(prisma, event.source.userId, command))
      const response = await lineRequest('reply', { replyToken: event.replyToken, messages: [message] })
      if (!response.accepted && response.status !== 400) throw new Error('LINE reply unavailable')
      }))
    }
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 }) }
}
