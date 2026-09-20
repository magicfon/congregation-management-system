'use client'

export type CurrentUserState =
  | { status: 'loading' | 'error' | 'signed-out' }
  | { status: 'ready'; name: string | null; role: string }

const ROLE_LABELS: Record<string, string> = {
  admin: '管理員', elder: '長老', publisher: '一般成員',
}

export default function CurrentUser({ state, onRetry }: { state: CurrentUserState; onRetry: () => void }) {
  if (state.status === 'loading') return <span role="status" className="text-xs text-mc-text/50">載入登入資訊…</span>
  if (state.status === 'error') return <button type="button" onClick={onRetry} className="text-xs text-mc-text/60 underline underline-offset-4">登入資訊載入失敗・重試</button>
  if (state.status === 'signed-out') return <a href="/login" className="text-xs text-mc-highlight">登入已失效・重新登入</a>
  if (state.status !== 'ready') return null
  const name = state.name?.trim() || '未設定姓名'
  const role = ROLE_LABELS[state.role] || '未識別角色'
  return (
    <div aria-label={`登入者：${name}，角色：${role}`} className="flex min-w-0 items-center justify-end gap-2 text-xs">
      <span className="hidden lg:inline text-mc-text/50 shrink-0">登入者</span>
      <span title={name} className="truncate text-mc-text font-medium">{name}</span>
      <span className={`shrink-0 rounded border px-1.5 py-0.5 ${state.role === 'admin' ? 'border-blue-400/30 bg-blue-400/10 text-blue-300' : 'border-white/10 text-mc-text/70'}`}>
        {role}
      </span>
    </div>
  )
}
