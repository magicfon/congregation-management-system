import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: '此登入端點已停用，請使用 NextAuth /api/auth/* 登入流程' },
    { status: 410 }
  )
}
