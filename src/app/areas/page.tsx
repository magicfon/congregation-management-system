'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Area {
  id: string
  name: string
  description: string | null
  assignedTo: string | null
  lastActivityAt: string
  createdAt: string
  _count: { schedules: number; reports: number }
}

function AreaModal({
  area,
  onClose,
  onSave,
}: {
  area: Area | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(area?.name ?? '')
  const [description, setDescription] = useState(area?.description ?? '')
  const [assignedTo, setAssignedTo] = useState(area?.assignedTo ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = area ? `/api/areas/${area.id}` : '/api/areas'
      const method = area ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, assignedTo }),
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
          <h2 className="text-base font-semibold text-mc-text">{area ? '編輯區域' : '新增區域'}</h2>
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
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">區域名稱 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="例：東區第一街道"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="區域說明（可選）"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">負責人</label>
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="負責人姓名（可選）"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-sm transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors border border-blue-500/30"
            >
              {loading ? '處理中…' : area ? '儲存變更' : '新增區域'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ area, onClose, onDelete }: { area: Area; onClose: () => void; onDelete: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/areas/${area.id}`, { method: 'DELETE' })
    onDelete()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-mc-card border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-mc-error/10 border border-mc-error/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-mc-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-mc-text">確認刪除</h3>
          <p className="text-sm text-mc-text/50 mt-2">
            確定要刪除區域「<span className="text-mc-text font-medium">{area.name}</span>」？此操作無法還原。
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text text-sm transition-colors">
            取消
          </button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-mc-error/80 hover:bg-mc-error disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {loading ? '刪除中…' : '確認刪除'}
          </button>
        </div>
      </div>
    </div>
  )
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalArea, setModalArea] = useState<Area | null | undefined>(undefined) // undefined = closed
  const [deleteArea, setDeleteArea] = useState<Area | null>(null)

  const fetchAreas = useCallback(async () => {
    setLoading(true)
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/areas${params}`)
    const data = await res.json()
    setAreas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchAreas, 300)
    return () => clearTimeout(t)
  }, [fetchAreas])

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-mc-text">區域管理</h1>
            <p className="text-mc-text/50 text-sm mt-1">管理所有服務區域</p>
          </div>
          <button
            onClick={() => setModalArea(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 text-white text-sm font-medium transition-colors border border-blue-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增區域
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋區域名稱或描述…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-mc-card border border-white/5 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/40 transition-colors text-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-mc-card border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-mc-accent/50">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">區域名稱</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider hidden md:table-cell">負責人</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider hidden lg:table-cell">排班 / 回報</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">最後活動</th>
                  <th className="text-right px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">載入中…</td>
                  </tr>
                ) : areas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">
                      {search ? '找不到符合的區域' : '尚無區域資料，點擊「新增區域」開始'}
                    </td>
                  </tr>
                ) : (
                  areas.map((area) => {
                    const idle = daysSince(area.lastActivityAt)
                    const isIdle = idle >= 30
                    return (
                      <tr key={area.id} className="hover:bg-mc-accent/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isIdle ? 'bg-mc-warning' : 'bg-mc-success'}`} />
                            <div>
                              <div className="text-sm font-medium text-mc-text">{area.name}</div>
                              {area.description && (
                                <div className="text-xs text-mc-text/40 mt-0.5 line-clamp-1">{area.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="text-sm text-mc-text/60">{area.assignedTo ?? '—'}</span>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className="text-xs text-mc-text/50">
                            {area._count.schedules} 排班 · {area._count.reports} 回報
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className={`text-sm ${isIdle ? 'text-mc-warning' : 'text-mc-text/50'}`}>
                            {idle === 0 ? '今天' : `${idle} 天前`}
                          </div>
                          {isIdle && <div className="text-xs text-mc-warning/60">閒置警告</div>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setModalArea(area)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => setDeleteArea(area)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-mc-error/20 text-mc-error/70 hover:text-mc-error hover:bg-mc-error/10 transition-colors"
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && areas.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 text-xs text-mc-text/30">
              共 {areas.length} 個區域
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalArea !== undefined && (
        <AreaModal
          area={modalArea}
          onClose={() => setModalArea(undefined)}
          onSave={() => { setModalArea(undefined); fetchAreas() }}
        />
      )}
      {deleteArea && (
        <DeleteConfirm
          area={deleteArea}
          onClose={() => setDeleteArea(null)}
          onDelete={() => { setDeleteArea(null); fetchAreas() }}
        />
      )}
    </DashboardLayout>
  )
}
