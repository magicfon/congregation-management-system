import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'

export async function GET() {
  try {
    // 嘗試導入 authOptions
    const { authOptions } = await import('../../../lib/auth')

    // 嘗試創建 NextAuth handler
    let nextauthHandler = 'FAILED'
    let nextauthError = null

    try {
      const handler = NextAuth(authOptions)
      nextauthHandler = 'SUCCESS'

      // 嘗試調用 handler
      const mockRequest = new Request('http://localhost:3000/api/auth/session', {
        method: 'GET',
      })
      const response = await handler(mockRequest, { params: {} })
      const text = await response.text()

      return NextResponse.json({
        status: 'ok',
        nextauthHandler,
        handlerResponse: {
          status: response.status,
          statusText: response.statusText,
          body: text.substring(0, 500),
        },
        authOptions: {
          providers: authOptions.providers.length,
          sessionStrategy: authOptions.session?.strategy,
          pages: authOptions.pages,
        },
      })
    } catch (error) {
      nextauthError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }
    }

    return NextResponse.json({
      status: 'partial',
      nextauthHandler,
      nextauthError,
      authOptions: {
        providers: authOptions.providers.length,
        sessionStrategy: authOptions.session?.strategy,
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
