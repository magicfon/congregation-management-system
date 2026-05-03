import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/areas',
  '/members',
  '/reports',
  '/schedules',
  '/statistics',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/areas/:path*', '/members/:path*', '/reports/:path*', '/schedules/:path*', '/statistics/:path*'],
}
