import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      hasUrl: !!process.env.NEXTAUTH_URL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasLineId: !!process.env.LINE_CLIENT_ID,
      hasLineSecret: !!process.env.LINE_CLIENT_SECRET,
      providers: authOptions.providers.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type
      }))
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
