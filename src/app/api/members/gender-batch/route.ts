import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiUser } from '@/lib/api-auth'

const genders = ['brother', 'sister', 'unspecified']
class Conflict extends Error {}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: '資料格式錯誤' }, { status: 400 }) }
  const changes = body?.changes
  if (!Array.isArray(changes) || !changes.length || changes.length > 1000 || changes.some(change =>
    !change || typeof change.id !== 'string' || !change.id || !genders.includes(change.gender) || !genders.includes(change.expectedGender)
  ) || new Set(changes.map(change => change.id)).size !== changes.length) {
    return NextResponse.json({ error: '請提供有效且不重複的人員設定' }, { status: 400 })
  }
  try {
    await prisma.$transaction(async tx => {
      const actor = await tx.member.findUnique({ where: { id: auth.user.id! }, select: { role: true, active: true, deletedAt: true } })
      if (!actor?.active || actor.deletedAt || actor.role !== 'admin') throw new Error('FORBIDDEN')
      for (const gender of genders) for (const expectedGender of genders) {
        const ids = changes.filter(change => change.gender === gender && change.expectedGender === expectedGender).map(change => change.id)
        if (!ids.length) continue
        const result = await tx.member.updateMany({ where: { id: { in: ids }, deletedAt: null, gender: expectedGender }, data: { gender } })
        if (result.count !== ids.length) throw new Conflict()
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({ updated: changes.length })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: '權限不足' }, { status: 403 })
    if (error instanceof Conflict || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
      return NextResponse.json({ error: '部分人員已被修改或刪除，本次未儲存。請取消變更、重新確認後再設定。' }, { status: 409 })
    }
    console.error('Batch gender update failed:', error)
    return NextResponse.json({ error: '無法儲存，請稍後重試' }, { status: 500 })
  }
}
