'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  active: boolean
  createdAt: string
  _count: { schedules: number; reports: number }
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理員',
  elder: '長老',
  publisher: '傳道員',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  elder: 'text-mc-warning bg-mc-warning/10 border-mc-warning/20',
  publisher: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Member | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [role, setRole] = useState(member?.role ?? 'publisher')
  const [active, setActive] = useState(member?.active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = member ? `/api/members/${member.id}` : '/api/members'
      const method = member ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { name, email, phone, role, active }
      if (!member || password) body.password = password
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '操作失敗')
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-mc-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-mc-text">{member ? '編輯成員' : '新增成員'}</h2>
          <button onClick={onClose} className="text-mc-text/40 hover:text-mc-text transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-mc-error/10 border border-mc-error/30 text-mc-error text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">姓名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="例：王大明"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">電子郵件 *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@congregation.local"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">
              {member ? '新密碼（留空則不更改）' : '密碼 *（最少 6 個字元）'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!member}
              minLength={member ? 0 : 6}
              placeholder={member ? '留空則不更改' : '請輸入密碼'}
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-mc-text/70 mb-1.5">電話</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912-345-678"
                className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mc-text/70 mb-1.5">角色 *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
              >
                <option value="publisher">傳道員</option>
                <option value="elder">長老</option>
                <option value="admin">管理員</option>
              </select>
            </div>
          </div>

          {member && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm text-mc-text/70">帳號啟用中</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-sm transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors border border-blue-500/30">
              {loading ? '處理中…' : member ? '儲存變更' : '新增成員'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalMember, setModalMember] = useState<Member | null | undefined>(undefined)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterRole) params.set('role', filterRole)
    if (showInactive) params.set('active', 'false')
    const res = await fetch(`/api/members?${params}`)
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, filterRole, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchMembers, 300)
    return () => clearTimeout(t)
  }, [fetchMembers])

  async function handleToggleActive(member: Member) {
    await fetch(`/api/members/${member.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        active: !member.active,
      }),
    })
    fetchMembers()
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-mc-text">成員管理</h1>
            <p className="text-mc-text/50 text-sm mt-1">管理會眾成員帳號</p>
          </div>
          <button
            onClick={() => setModalMember(null)}
            className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 text-white text-sm font-medium transition-colors border border-blue-500/30 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">新增成員</span>
            <span className="sm:hidden">新增</span>
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 md:space-y-0 md:flex md:flex-wrap md:gap-3 mb-4 md:mb-6">
          <div className="relative md:flex-1 md:min-w-48">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋姓名、郵件或電話…"
              className="w-full pl-10 pr-4 py-3 md:py-2.5 rounded-lg bg-mc-card border border-white/5 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/40 transition-colors text-sm min-h-[44px]"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[['', '全部'], ['publisher', '傳道員'], ['elder', '長老'], ['admin', '管理員']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterRole(val)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors min-h-[44px] ${
                  filterRole === val
                    ? 'bg-mc-highlight text-white border-blue-500/30'
                    : 'border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent'
                }`}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-mc-text/50 hover:text-mc-text transition-colors min-h-[44px] px-1">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              已停用
            </label>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-16 text-mc-text/30 text-sm">載入中…</div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 text-mc-text/30 text-sm">找不到符合的成員</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className={`bg-mc-card border border-white/5 rounded-xl p-4 ${!m.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${ROLE_COLORS[m.role]}`}>
                      {m.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-mc-text">{m.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[m.role] ?? 'text-mc-text/50 bg-white/5 border-white/10'}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                        {!m.active && <span className="text-xs text-mc-text/30">已停用</span>}
                      </div>
                      <div className="text-xs text-mc-text/50 mt-0.5 truncate">{m.email}</div>
                      {m.phone && <div className="text-xs text-mc-text/40">{m.phone}</div>}
                      <div className="text-xs text-mc-text/40 mt-1">
                        {m._count.schedules} 排班 · {m._count.reports} 回報
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setModalMember(m)}
                      className="p-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                      aria-label="編輯"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(m)}
                      className={`p-2.5 rounded-lg border transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center ${
                        m.active
                          ? 'border-mc-error/20 text-mc-error/70 hover:text-mc-error hover:bg-mc-error/10'
                          : 'border-mc-success/20 text-mc-success/70 hover:text-mc-success hover:bg-mc-success/10'
                      }`}
                      aria-label={m.active ? '停用' : '啟用'}
                    >
                      {m.active ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          {!loading && members.length > 0 && (
            <div className="text-xs text-mc-text/30 text-center py-2">共 {members.length} 位成員</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-mc-card border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-mc-accent/50">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">姓名</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">聯絡方式</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">角色</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider hidden lg:table-cell">活動記錄</th>
                  <th className="text-right px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">載入中…</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">找不到符合的成員</td></tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className={`hover:bg-mc-accent/30 transition-colors ${!m.active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${ROLE_COLORS[m.role]}`}>
                            {m.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-mc-text">{m.name}</div>
                            {!m.active && <div className="text-xs text-mc-text/30">已停用</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-mc-text/50">{m.email}</div>
                        {m.phone && <div className="text-xs text-mc-text/40">{m.phone}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${ROLE_COLORS[m.role] ?? 'text-mc-text/50 bg-white/5 border-white/10'}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-xs text-mc-text/50">
                          {m._count.schedules} 排班 · {m._count.reports} 回報
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setModalMember(m)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleToggleActive(m)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              m.active
                                ? 'border-mc-error/20 text-mc-error/70 hover:text-mc-error hover:bg-mc-error/10'
                                : 'border-mc-success/20 text-mc-success/70 hover:text-mc-success hover:bg-mc-success/10'
                            }`}
                          >
                            {m.active ? '停用' : '啟用'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && members.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 text-xs text-mc-text/30">
              共 {members.length} 位成員
            </div>
          )}
        </div>
      </div>

      {modalMember !== undefined && (
        <MemberModal
          member={modalMember}
          onClose={() => setModalMember(undefined)}
          onSave={() => { setModalMember(undefined); fetchMembers() }}
        />
      )}
    </DashboardLayout>
  )
}
