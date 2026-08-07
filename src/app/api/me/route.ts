import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'

// GET /api/me — returns current user info including role
export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null } | undefined

  if (!user?.id) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'publisher',
    isAdmin: user.role === 'admin',
  })
}
