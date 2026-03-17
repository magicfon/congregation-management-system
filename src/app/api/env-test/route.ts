import { NextResponse } from 'next/server'

export async function GET() {
  // 列出所有環境變量
  const allEnvVars = Object.keys(process.env).sort()
  
  // 檢查特定的環境變量
  const nextauthVars = {
    NEXTAUTH_SECRET: {
      exists: 'NEXTAUTH_SECRET' in process.env,
      value: process.env.NEXTAUTH_SECRET ? `SET (${process.env.NEXTAUTH_SECRET.length} chars)` : 'NOT_SET',
    },
    NEXTAUTH_URL: {
      exists: 'NEXTAUTH_URL' in process.env,
      value: process.env.NEXTAUTH_URL || 'NOT_SET',
    },
  }

  // 檢查所有以 NEXT 開頭的環境變量
  const nextVars = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT')) {
      nextVars[key] = value ? `SET (${value.length} chars)` : 'NOT_SET'
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    nextauthVars,
    nextVars,
    totalEnvVars: allEnvVars.length,
    envVarKeys: allEnvVars.slice(0, 50), // 只顯示前 50 個
  })
}
