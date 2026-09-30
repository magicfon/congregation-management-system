import { createHmac, timingSafeEqual } from 'crypto'

export function lineBotReady() {
  return process.env.LINE_BOT_ENABLED === 'true' && process.env.LINE_BOT_SAME_PROVIDER === 'true' && !!process.env.LINE_BOT_CHANNEL_SECRET && !!process.env.LINE_BOT_ACCESS_TOKEN
}
export function verifyLineSignature(body: Buffer, signature: string | null, secret: string) {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(body).digest('base64')
  const received = Buffer.from(signature), correct = Buffer.from(expected)
  return received.length === correct.length && timingSafeEqual(received, correct)
}
export const botSite = 'https://congregation-management-system.vercel.app'
export async function lineDisplayName(uid: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${process.env.LINE_BOT_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return null
    const profile = await response.json()
    return typeof profile.displayName === 'string' ? profile.displayName.slice(0, 200) : null
  } catch { return null }
}
export async function lineRequest(kind: 'reply' | 'push', body: unknown, retryKey?: string) {
  const response = await fetch(`https://api.line.me/v2/bot/message/${kind}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_BOT_ACCESS_TOKEN}`, ...(retryKey ? { 'X-Line-Retry-Key': retryKey } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  })
  // Do not log response bodies: they can include message contents or identifiers.
  return { accepted: response.ok || (kind === 'push' && response.status === 409 && !!response.headers.get('x-line-accepted-request-id')), status: response.status }
}
export function botText(text: string) {
  return { type: 'text', text: text.slice(0,4500), quickReply: { items: [...['我的地圖','本週行程','待交接'].map(label=>({ type: 'action', action: { type: 'message', label, text: label } })), { type: 'action', action: { type: 'uri', label: '通知設定', uri: `${botSite}/dashboard` } }] } }
}
