import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { botText, lineBotReady, lineRequest, verifyLineSignature } from '../../../../lib/line-bot-client'
import { lineBotAnswer } from '../../../../lib/line-bot-queries'
import { acknowledgeNotice, isNoticeAck, studentNoticeSample } from '../../../../lib/student-notice'
import { taipeiDate } from '../../../../lib/google-sheets'
import { waitUntil } from '@vercel/functions'
import { lineAiAnswer, lineAiReady } from '../../../../lib/line-ai'

// 固定指令照舊即時回覆；其他自由文字交給 AI 問答（ADR-0143）。
const fixedCommands = new Set(['我的委派', '我的地圖', '選單', '通知單樣式'])

async function answerWithAi(memberId: string, uid: string, replyToken: string, question: string) {
  let text: string
  try { text = (await lineAiAnswer(prisma, memberId, uid, question)).text }
  catch (error) {
    console.error('line-ai failed:', error instanceof Error ? error.message : 'unknown')
    text ='小幫手暫時無法回答，請稍後再試，或點下方「我的委派」「我的地圖」查詢。' }
  const reply = await lineRequest('reply', { replyToken, messages: [botText(text)] }).catch(() => ({ accepted: false, status: 0 }))
  // Reply token 約一分鐘失效；回答太慢時改用 push 補送。
  if (!reply.accepted) await lineRequest('push', { to: uid, messages: [botText(text)] }, randomUUID()).catch(() => undefined)
}
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
      if (command && !fixedCommands.has(command) && lineAiReady()) {
        const member = await prisma.member.findFirst({ where: { lineuid: event.source.userId, active: true, deletedAt: null }, select: { id: true } })
        if (member) {
          // AI 回覆可能要十幾秒：先顯示輸入中動畫、立即回 200，背景完成後用 reply token 回覆。
          await fetch('https://api.line.me/v2/bot/chat/loading/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_BOT_ACCESS_TOKEN}` }, body: JSON.stringify({ chatId: event.source.userId, loadingSeconds: 30 }), signal: AbortSignal.timeout(3000) }).catch(() => undefined)
          waitUntil(answerWithAi(member.id, event.source.userId, event.replyToken, command))
          return
        }
      }
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
