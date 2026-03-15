'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'

interface Area { id: string; name: string }
interface Member { id: string; name: string }

interface Schedule {
  id: string
  date: string
  timeSlot: string
  status: string
  notes: string | null
  area: Area
  member: Member
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: '已排班',
  completed: '已完成',
  cancelled: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  completed: 'text-mc-success bg-mc-success/10 border-mc-success/20',
  cancelled: 'text-mc-text/40 bg-white/5 border-white/10',
}

function ScheduleModal({
  schedule,
  areas,
  members,
  onClose,
  onSave,
}: {
  schedule: Schedule | null
  areas: Area[]
  members: Member[]
  onClose: () => void
  onSave: () => void
}) {
  const [areaId, setAreaId] = useState(schedule?.area.id ?? '')
  const [memberId, setMemberId] = useState(schedule?.member.id ?? '')
  const [date, setDate] = useState(schedule ? schedule.date.slice(0, 10) : '')
  const [timeSlot, setTimeSlot] = useState(schedule?.timeSlot ?? 'morning')
  const [notes, setNotes] = useState(schedule?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = schedule ? `/api/schedules/${schedule.id}` : '/api/schedules'
      const method = schedule ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, memberId, date, timeSlot, notes }),
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
          <h2 className="text-base font-semibold text-mc-text">{schedule ? '編輯排班' : '新增排班'}</h2>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-mc-text/70 mb-1.5">日期 *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mc-text/70 mb-1.5">時段 *</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
              >
                <option value="morning">上午</option>
                <option value="afternoon">下午</option>
                <option value="evening">晚上</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text/70 mb-1.5">備註</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="選填備註…"
              className="w-full px-4 py-2.5 rounded-lg bg-mc-accent border border-white/10 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-sm transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors border border-blue-500/30">
              {loading ? '處理中…' : schedule ? '儲存變更' : '新增排班'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')
  const [modalSchedule, setModalSchedule] = useState<Schedule | null | undefined>(undefined)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterAreaId) params.set('areaId', filterAreaId)
    const res = await fetch(`/api/schedules?${params}`)
    const data = await res.json()
    setSchedules(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterStatus, filterAreaId])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  useEffect(() => {
    fetch('/api/areas').then((r) => r.json()).then((d) => setAreas(Array.isArray(d) ? d : []))
    fetch('/api/members').then((r) => r.json()).then((d) => setMembers(Array.isArray(d) ? d : []))
  }, [])

  async function handleStatusChange(schedule: Schedule, newStatus: string) {
    await fetch(`/api/schedules/${schedule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchSchedules()
  }

  async function handleDelete(id: string) {
    if (!confirm('確定要刪除此排班？')) return
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    fetchSchedules()
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-mc-text">排班系統</h1>
            <p className="text-mc-text/50 text-sm mt-1">管理區域服務排班</p>
          </div>
          <button
            onClick={() => setModalSchedule(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-mc-highlight hover:bg-blue-700 text-white text-sm font-medium transition-colors border border-blue-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增排班
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
            {[['', '全部狀態'], ['scheduled', '已排班'], ['completed', '已完成'], ['cancelled', '已取消']].map(([val, label]) => (
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

        {/* Table */}
        <div className="bg-mc-card border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-mc-accent/50">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">日期 / 時段</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">區域</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">成員</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">狀態</th>
                  <th className="text-right px-5 py-3.5 text-xs font-medium text-mc-text/50 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">載入中…</td></tr>
                ) : schedules.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-mc-text/30 text-sm">尚無排班記錄</td></tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-mc-accent/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-mc-text">
                          {new Date(s.date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </div>
                        <div className="text-xs text-mc-text/40 mt-0.5">{TIME_SLOT_LABELS[s.timeSlot] ?? s.timeSlot}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-mc-text">{s.area.name}</td>
                      <td className="px-5 py-4 text-sm text-mc-text">{s.member.name}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLORS[s.status] ?? 'text-mc-text/50 bg-white/5 border-white/10'}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(s, 'completed')}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-mc-success/20 text-mc-success/70 hover:text-mc-success hover:bg-mc-success/10 transition-colors"
                              >
                                完成
                              </button>
                              <button
                                onClick={() => handleStatusChange(s, 'cancelled')}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-mc-text/50 hover:text-mc-text hover:bg-mc-accent transition-colors"
                              >
                                取消
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setModalSchedule(s)}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-mc-error/20 text-mc-error/60 hover:text-mc-error hover:bg-mc-error/10 transition-colors"
                          >
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && schedules.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 text-xs text-mc-text/30">
              共 {schedules.length} 筆排班
            </div>
          )}
        </div>
      </div>

      {modalSchedule !== undefined && (
        <ScheduleModal
          schedule={modalSchedule}
          areas={areas}
          members={members}
          onClose={() => setModalSchedule(undefined)}
          onSave={() => { setModalSchedule(undefined); fetchSchedules() }}
        />
      )}
    </DashboardLayout>
  )
}
