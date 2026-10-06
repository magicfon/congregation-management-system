import type { PrismaClient } from '@prisma/client'
import { recordPendingLineIdentity } from './pending-line-identities'
import { configuredLiffId } from './liff-settings'

export async function authorizeLiff(db: PrismaClient, idToken?: string) {
  if (!configuredLiffId() || !idToken || idToken.length > 16000) return null
  let response: Response
  try {
    response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CLIENT_ID!.trim() }),
      cache: 'no-store', signal: AbortSignal.timeout(8000),
    })
  } catch { throw new Error('LiffUnavailable') }
  if (response.status >= 500 || response.status === 429) throw new Error('LiffUnavailable')
  if (!response.ok) return null
  const identity = await response.json().catch(() => null)
  if (!identity || identity.iss !== 'https://access.line.me' || identity.aud !== process.env.LINE_CLIENT_ID!.trim()
    || typeof identity.exp !== 'number' || identity.exp <= Date.now() / 1000
    || typeof identity.sub !== 'string' || !/^U[0-9a-f]{32}$/i.test(identity.sub)) return null
  const member = await db.member.findUnique({ where: { lineuid: identity.sub } })
  const name = typeof identity.name === 'string' ? identity.name.slice(0, 200) : null
  if (!member) {
    await recordPendingLineIdentity(db, identity.sub, name)
    throw new Error('LinePending')
  }
  if (!member.active || member.deletedAt) return null
  await db.member.update({ where: { id: member.id }, data: { lineDisplayName: name } })
  return { id: member.id, name: member.name, email: member.email, role: member.role, lineUid: identity.sub }
}
