import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { memberLineFields } from '../../../../lib/member-fields'
import { prisma } from '../../../../lib/db'
import { deleteMember, MemberDeletionError } from '../../../../lib/member-deletion'
import { requireApiUser } from '../../../../lib/api-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id, deletedAt: null },
      select: {
        ...memberLineFields,
        schedules: {
          include: { scheduleAreas: { include: { area: { select: { id: true, name: true } } } } },
          orderBy: { date: 'desc' },
          take: 10,
        },
        reports: {
          include: { area: { select: { id: true, name: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
        _count: { select: { schedules: true, reports: true } },
      },
    })

    if (!member) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    return NextResponse.json(member)
  } catch (error) {
    console.error('GET /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法取得成員資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    if (body.showInDispatch !== undefined && typeof body.showInDispatch !== 'boolean') {
      return NextResponse.json({ error: '派發按鈕設定必須為布林值' }, { status: 400 })
    }
    if (body.active !== undefined && typeof body.active !== 'boolean') return NextResponse.json({ error: '帳號狀態格式錯誤' }, { status: 400 })
    if (body.role !== undefined && (!['admin', 'publisher'].includes(body.role) || typeof body.expectedRole !== 'string')) return NextResponse.json({ error: '權限設定格式錯誤' }, { status: 400 })
    const { name, email, phone, active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
    }

    return await prisma.$transaction(async tx => {
      const actor = await tx.member.findUnique({ where: { id: auth.user.id! }, select: { role: true, active: true, deletedAt: true } })
      if (!actor?.active || actor.deletedAt || actor.role !== 'admin') return NextResponse.json({ error: '權限不足' }, { status: 403 })
      const existing = await tx.member.findUnique({ where: { id: params.id, deletedAt: null }, select: { id: true, email: true, active: true, role: true } })
      if (!existing) return NextResponse.json({ error: '成員不存在' }, { status: 404 })
      if (body.role !== undefined && body.expectedRole !== existing.role) return NextResponse.json({ error: '權限已被修改，請重新整理' }, { status: 409 })
      const nextRole = body.role ?? existing.role
      const nextActive = active ?? existing.active
      if (existing.role === 'admin' && existing.active && (nextRole !== 'admin' || !nextActive)) {
        const others = await tx.member.count({ where: { id: { not: existing.id }, role: 'admin', active: true, deletedAt: null } })
        if (!others) return NextResponse.json({ error: '至少需保留一位啟用中的管理員' }, { status: 409 })
      }
      const member = await tx.member.update({
        select: memberLineFields, where: { id: params.id, deletedAt: null },
        data: {
          ...(body.showInDispatch !== undefined ? { showInDispatch: body.showInDispatch } : {}),
          name: name.trim(), email: email?.trim() || existing.email, phone: phone?.trim() || null,
          active: nextActive, role: nextRole,
        },
      })
      return NextResponse.json(member)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return NextResponse.json({ error: '資料已更新，請重新整理後再試' }, { status: 409 })
    console.error('PUT /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法更新成員' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const body = await request.json()
    if (typeof body.showInDispatch !== 'boolean') {
      return NextResponse.json({ error: '派發設定格式錯誤' }, { status: 400 })
    }
    const result = await prisma.member.updateMany({
      where: { id: params.id, deletedAt: null },
      data: { showInDispatch: body.showInDispatch },
    })
    if (!result.count) return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    return NextResponse.json({ showInDispatch: body.showInDispatch })
  } catch {
    return NextResponse.json({ error: '無法更新派發設定' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    await deleteMember(prisma, params.id, auth.user.id!)

    return NextResponse.json({ message: '成員已刪除' })
  } catch (error) {
    if (error instanceof MemberDeletionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('DELETE /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法刪除成員' }, { status: 500 })
  }
}
