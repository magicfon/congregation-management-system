'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function DebugLinePage() {
  const { data: session, status } = useSession()
  const [lineUid, setLineUid] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      // 從 URL 參數或 localStorage 獲取 LINE UID
      const params = new URLSearchParams(window.location.search)
      const uid = params.get('line_uid')
      if (uid) {
        setLineUid(uid)
      }
    }
  }, [status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">載入中...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">LINE UID 查詢工具</h1>
          <p className="text-slate-400 mb-6">點擊下方按鈕用 LINE 登入，即可查看你的 LINE UID</p>
          <button
            onClick={() => signIn('line', { callbackUrl: '/debug-line' })}
            className="px-6 py-3 bg-[#00B900] text-white rounded-lg font-medium hover:bg-[#00A000] transition"
          >
            用 LINE 登入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-4">LINE UID 查詢結果</h1>
        
        {lineUid ? (
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <p className="text-slate-400 mb-2">你的 LINE UID：</p>
            <p className="text-xl font-mono text-green-400 break-all">{lineUid}</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <p className="text-yellow-400">⚠️ 無法獲取 LINE UID</p>
            <p className="text-slate-400 text-sm mt-2">
              可能是因為你使用 email 登入，而非 LINE 登入
            </p>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
          <p className="text-slate-400 text-sm">登入資訊：</p>
          <p className="text-white">姓名：{session?.user?.name}</p>
          <p className="text-white">Email：{session?.user?.email}</p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/debug-line' })}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          登出
        </button>
      </div>
    </div>
  )
}
