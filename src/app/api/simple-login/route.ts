import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // 查詢用戶
    const { data: member, error } = await supabase
      .from('members')
      .select('id, email, name, role, active, password')
      .eq('email', email)
      .single()

    if (error || !member) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (!member.active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      )
    }

    // 驗證密碼
    const isPasswordValid = await compare(password, member.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 返回用戶信息（不包括密碼）
    const { password: _, ...userWithoutPassword } = member
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
