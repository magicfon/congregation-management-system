import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const envCheck = {
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      LINE_CLIENT_ID: !!process.env.LINE_CLIENT_ID,
      LINE_CLIENT_SECRET: !!process.env.LINE_CLIENT_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    }

    // 嘗試導入 auth.ts
    let authImport = 'SUCCESS'
    try {
      const { authOptions } = await import('../../../lib/auth')
      authImport = `SUCCESS - Providers: ${authOptions.providers.length}`
    } catch (error) {
      authImport = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      authImport,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
