import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
  try {
    const auth = await requireApiUser()
    if (auth.response) {
      for (const [key, value] of Object.entries(headers)) auth.response.headers.set(key, value)
      return auth.response
    }
    const member = await prisma.member.findFirst({ where: { id: auth.user.id, active: true, deletedAt: null }, select: { id: true } })
    const person = member ? await prisma.servicePerson.findUnique({ where: { memberId: member.id }, select: { id: true } }) : null
    return NextResponse.json({ personId: person?.id ?? null }, { headers })
  } catch {
    return NextResponse.json({ personId: null }, { status: 503, headers })
  }
}
