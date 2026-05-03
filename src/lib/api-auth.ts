import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

type Role = 'admin' | 'elder' | 'publisher'

type ApiUser = {
  id?: string
  role?: string
  name?: string | null
  email?: string | null
}

const ROLE_LEVEL: Record<Role, number> = {
  publisher: 1,
  elder: 2,
  admin: 3,
}

function isAllowed(role: string | undefined, allowedRoles?: Role[]) {
  if (!role) return false
  if (!allowedRoles || allowedRoles.length === 0) return true
  return allowedRoles.includes(role as Role)
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '尚未登入' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: '權限不足' }, { status: 403 })
}

export async function requireApiUser(allowedRoles?: Role[]) {
  const session = await getServerSession(authOptions)
  const user = session?.user as ApiUser | undefined

  if (!user?.id) {
    return { response: unauthorizedResponse() }
  }

  if (!isAllowed(user.role, allowedRoles)) {
    return { response: forbiddenResponse() }
  }

  return { user }
}

export function rolesAtLeast(minRole: Role): Role[] {
  const minLevel = ROLE_LEVEL[minRole]
  return (Object.keys(ROLE_LEVEL) as Role[]).filter((role) => ROLE_LEVEL[role] >= minLevel)
}
