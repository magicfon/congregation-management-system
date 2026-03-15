'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Area { id: string; name: string }
interface Member { id: string; name: string }

interface Report {
  id: string
  content: string
  status: string
  reviewedBy: string | null
  reviewedAt: string | null
  submittedAt: string
  area: Area
  member: Member
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待審核',
  reviewed: '已審閱',
  approved: '已核准',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-mc-warning bg-mc-warning/10 border-mc-warning/20',
  reviewed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  approved: 'text-mc-success bg-mc-success/10 border-mc-success/20',
}

function ReportModal({
  report,
  areas,
  members,
  onClose,
  onSave,
}: {
  report: Report | null
  areas: Area[]
  members: Member[]
  onClose: () => void
  onSave: () => void
}) {
  const [areaId, setAreaId] = useState(report?.area.id ?? '')
  const [memberId, setMemberId] = useState(report?.member.id ?? '')
  const [content, setContent] = useState(report?.content ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = report ? `/api/reports/${report.id}` : '/api/reports'
      const method = report ? 'PUT' : 'POST'
      const body = report ? { content } : { areaId, memberId, content }
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
          <h2 className="text-base font-semibold text-mc-text">{report ? '編輯回報' : '提交回報'}</h2>
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

          {!report && (
            <>
              <div>
                <label className="block text-sm font-medium text-mc-text/70 mb-1.5">區域 *</label>
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
                >
                  <option value="">請選擇區域</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text/70 mb-1.5">成員 *</label>
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
                >
                  <option value="">請選擇成員</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">回報內容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              placeholder="請描述服務情況…"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-sm transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors border border-blue-500/30">
              {loading ? '處理中…' : report ? '儲存變更' : '提交回報'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')
  const [modalReport, setModalReport] = useState<Report | null | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterAreaId) params.set('areaId', filterAreaId)
    const res = await fetch(`/api/reports?${params}`)
    const data = await res.json()
    setReports(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterStatus, filterAreaId])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useEffect(() => {
    fetch('/api/areas').then((r) => r.json()).then((d) => setAreas(Array.isArray(d) ? d : []))
    fetch('/api/members').then((r) => r.json()).then((d) => setMembers(Array.isArray(d) ? d : []))
  }, [])

  async function handleReview(report: Report, newStatus: string) {
    await fetch(`/api/reports/${report.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchReports()
  }

  async function handleDelete(id: string) {
    if (!confirm('確定要刪除此回報？')) return
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    fetchReports()
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-mc-text">回報系統</h1>
            <p className="text-mc-text/50 text-sm mt-1">服務回報提交與審核</p>
          </div>
          <button
            onClick={() => setModalReport(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 text-white text-sm font-medium transition-colors border border-blue-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            提交回報
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filterAreaId}
            onChange={(e) => setFilterAreaId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-mc-card border border-white/5 text-mc-text text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
          >
            <option value="">全部區域</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="flex gap-2">
            {[['', '全部狀態'], ['pending', '待審核'], ['reviewed', '已審閱'], ['approved', '已核准']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  filterStatus === val
                    ? 'bg-mc-highlight text-white border-blue-500/30'
                    : 'border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="text-center py-16 text-mc-text/30 text-sm">載入中…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-mc-text/30 text-sm">尚無回報記錄</div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-mc-card border border-white/5 rounded-xl overflow-hidden">
                <div
                  className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-mc-accent/20 transition-colors"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-mc-text">{r.area.name}</span>
                        <span className="text-mc-text/30">·</span>
                        <span className="text-sm text-mc-text/60">{r.member.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] ?? 'text-mc-text/40 bg-white/5 border-white/10'}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </div>
                      <div className="text-xs text-mc-text/30 mt-1">
                        {new Date(r.submittedAt).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      {expandedId !== r.id && (
                        <p className="text-sm text-mc-text/60 mt-1.5 truncate">{r.content}</p>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-mc-text/30 flex-shrink-0 ml-3 mt-0.5 transition-transform ${expandedId === r.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expandedId === r.id && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <p className="text-sm text-mc-text/80 mt-3 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                    {r.reviewedBy && (
                      <p className="text-xs text-mc-text/30 mt-2">
                        審核者：{r.reviewedBy}
                        {r.reviewedAt && ` · ${new Date(r.reviewedAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </p>
                    )}
                    <div className="flex gap-2 mt-4">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleReview(r, 'reviewed')}
                            className="px-3 py-1.5 text-xs rounded-lg border border-blue-500/20 text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            標記審閱
                          </button>
                          <button
                            onClick={() => handleReview(r, 'approved')}
                            className="px-3 py-1.5 text-xs rounded-lg border border-mc-success/20 text-mc-success/70 hover:text-mc-success hover:bg-mc-success/10 transition-colors"
                          >
                            核准
                          </button>
                        </>
                      )}
                      {r.status === 'reviewed' && (
                        <button
                          onClick={() => handleReview(r, 'approved')}
                          className="px-3 py-1.5 text-xs rounded-lg border border-mc-success/20 text-mc-success/70 hover:text-mc-success hover:bg-mc-success/10 transition-colors"
                        >
                          核准
                        </button>
                      )}
                      <button
                        onClick={() => setModalReport(r)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-mc-error/20 text-mc-error/60 hover:text-mc-error hover:bg-mc-error/10 transition-colors"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="mt-4 text-xs text-mc-text/30">共 {reports.length} 筆回報</div>
        )}
      </div>

      {modalReport !== undefined && (
        <ReportModal
          report={modalReport}
          areas={areas}
          members={members}
          onClose={() => setModalReport(undefined)}
          onSave={() => { setModalReport(undefined); fetchReports() }}
        />
      )}
    </DashboardLayout>
  )
}
