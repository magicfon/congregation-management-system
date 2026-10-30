'use client'

import { useEffect, useState } from 'react'

export type CurrentUserState =
  | { status: 'loading' | 'error' | 'signed-out' }
  | { status: 'ready'; name: string | null; role: string; image?: string | null }

const ROLE_LABELS: Record<string, string> = {
  admin: '管理員', elder: '長老', publisher: '一般成員',
}

// Shows the LINE profile picture; falls back (default: nothing) when absent or broken so the layout stays as before.
export function LineAvatar({ src, className = 'h-7 w-7', fallback = null }: { src?: string | null; className?: string; fallback?: React.ReactNode }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) return <>{fallback}</>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`${className} shrink-0 rounded-full border border-white/10 object-cover`} />
}

export default function CurrentUser({ state, onRetry }: { state: CurrentUserState; onRetry: () => void }) {
  if (state.status === 'loading') return <span role="status" className="text-xs text-mc-text/50">載入登入資訊…</span>
  if (state.status === 'error') return <button type="button" onClick={onRetry} className="text-xs text-mc-text/60 underline underline-offset-4">登入資訊載入失敗・重試</button>
  if (state.status === 'signed-out') return <a href="/login" className="text-xs text-mc-highlight">登入已失效・重新登入</a>
  if (state.status !== 'ready') return null
  const name = state.name?.trim() || '未設定姓名'
  const role = ROLE_LABELS[state.role] || '未識別角色'
  return (
    <div aria-label={`登入者：${name}，角色：${role}`} className="flex min-w-0 items-center flex-wrap justify-start gap-2 text-xs">
      <LineAvatar src={state.image} />
      <span className="text-mc-text/50 shrink-0">登入者</span>
      <span title={name} className="truncate text-mc-text font-medium">{name}</span>
      <span className={`shrink-0 rounded border px-1.5 py-0.5 ${state.role === 'admin' ? 'border-blue-400/30 bg-blue-400/10 text-blue-300' : 'border-white/10 text-mc-text/70'}`}>
        {role}
      </span>
    </div>
  )
}
