'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Plus, Trash2, Edit3, X, MapPin, Clock, Users,
  CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight, User, Video, Building2
} from 'lucide-react'

interface ScheduleArea {
  id: string
  scheduleId: string
  areaId: string
  completed: boolean
  completedAt: string | null
  area: {
    id: string
    name: string
    mapId: string | null
    mapAreaId: number | null
  }
}

interface Schedule {
  id: string
  date: string
  timeSlot: string
  timeStart: string | null
  timeEnd: string | null
  group: string
  leaderId: string | null
  leader: { id: string; name: string } | null
  preMeetingType: string | null
  preMeetingTime: string | null
  meetingLocation: string | null
  status: string
  notes: string | null
  scheduleAreas: ScheduleArea[]
}

interface Member {
  id: string
  name: string
}

interface Area {
  id: string
  name: string
  mapId: string | null
  mapAreaId: number | null
  assignedTo: string | null
}

const TIME_SLOTS = [
  { value: 'morning', label: '早上' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
]

const PRE_MEETING_TYPES = [
  { value: 'zoom', label: 'Zoom', icon: Video },
  { value: '聚會所', label: '聚會所', icon: Building2 },
  { value: '無', label: '沒有', icon: X },
]

const GROUPS = ['AB', '集體']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}/${d.getDate()} 星期${days[d.getDay()]}`
}

function getTimeSlotLabel(slot: string) {
  return TIME_SLOTS.find(t => t.value === slot)?.label || slot
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    date: '',
    timeSlot: 'morning',
    timeStart: '09:30',
    timeEnd: '11:00',
    group: '集體',
    leaderId: '',
    preMeetingType: 'zoom',
    preMeetingTime: '08:45',
    meetingLocation: '',
    notes: '',
    areaIds: [] as string[],
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, memberRes, areaRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/members'),
        fetch('/api/areas'),
      ])

      const scheds = await schedRes.json()
      const mems = await memberRes.json()
      const ars = await areaRes.json()

      setSchedules(Array.isArray(scheds) ? scheds : [])
      setMembers(Array.isArray(mems) ? mems.map((m: any) => ({ id: m.id, name: m.name })) : [])
      setAreas(Array.isArray(ars) ? ars.map((a: any) => ({
        id: a.id,
        name: a.name,
        mapId: a.mapId,
        mapAreaId: a.mapAreaId,
        assignedTo: a.assignedTo,
      })) : [])
    } catch (err) {
      setError('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setForm({
      date: '',
      timeSlot: 'morning',
      timeStart: '09:30',
      timeEnd: '11:00',
      group: '集體',
      leaderId: '',
      preMeetingType: 'zoom',
      preMeetingTime: '08:45',
      meetingLocation: '',
      notes: '',
      areaIds: [],
    })
    setEditingId(null)
  }

  function startEdit(schedule: Schedule) {
    const d = new Date(schedule.date)
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setForm({
      date: localDate,
      timeSlot: schedule.timeSlot,
      timeStart: schedule.timeStart || '',
      timeEnd: schedule.timeEnd || '',
      group: schedule.group,
      leaderId: schedule.leaderId || '',
      preMeetingType: schedule.preMeetingType || '',
      preMeetingTime: schedule.preMeetingTime || '',
      meetingLocation: schedule.meetingLocation || '',
      notes: schedule.notes || '',
      areaIds: schedule.scheduleAreas?.map(sa => sa.areaId) || [],
    })
    setEditingId(schedule.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.date) return
    setSaving(true)
    try {
      const payload = { ...form }
      const url = editingId ? `/api/schedules/${editingId}` : '/api/schedules'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('儲存失敗')
      await loadData()
      setShowForm(false)
      resetForm()
    } catch (err) {
      setError('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('確定刪除此行程？')) return
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleToggleComplete(sa: ScheduleArea) {
    setReporting(sa.id)
    try {
      const res = await fetch(`/api/schedule-areas/${sa.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !sa.completed }),
      })
      if (!res.ok) throw new Error('回報失敗')
      await loadData()
    } catch (err) {
      console.error('Toggle failed:', err)
    } finally {
      setReporting(null)
    }
  }

  function toggleAreaSelection(areaId: string) {
    setForm(prev => ({
      ...prev,
      areaIds: prev.areaIds.includes(areaId)
        ? prev.areaIds.filter(id => id !== areaId)
        : [...prev.areaIds, areaId],
    }))
  }

  // Filter areas by leader assignment for convenience
  const leaderAreas = form.leaderId
    ? areas.filter(a => a.assignedTo === members.find(m => m.id === form.leaderId)?.name)
    : areas

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-mc-text">傳道行程</h2>
          <p className="text-xs text-mc-text/50 mt-0.5">管理傳道排程與區域回報</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增行程
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-mc-bg border border-white/10 rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-bold text-mc-text">{editingId ? '編輯行程' : '新增行程'}</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="text-mc-text/40 hover:text-mc-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Date & Time */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">日期 *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">時段</label>
                  <select value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60">
                    {TIME_SLOTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">小組</label>
                  <select value={form.group} onChange={e => setForm({ ...form, group: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60">
                    {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">開始時間</label>
                  <input type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">結束時間</label>
                  <input type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">負責人</label>
                  <select value={form.leaderId} onChange={e => setForm({ ...form, leaderId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60">
                    <option value="">— 選擇 —</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Pre-meeting */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">傳道前聚會</label>
                  <select value={form.preMeetingType} onChange={e => setForm({ ...form, preMeetingType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60">
                    {PRE_MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-mc-text/50 mb-1">聚會時間</label>
                  <input type="time" value={form.preMeetingTime} onChange={e => setForm({ ...form, preMeetingTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
                </div>
              </div>

              {/* Meeting location */}
              <div>
                <label className="block text-xs text-mc-text/50 mb-1">集合地點</label>
                <input type="text" value={form.meetingLocation} placeholder="地址 + 地標（如：德民路900號 7-11）"
                  onChange={e => setForm({ ...form, meetingLocation: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
              </div>

              {/* Area selection */}
              <div>
                <label className="block text-xs text-mc-text/50 mb-1">
                  分配區域 ({form.areaIds.length} 個已選)
                  {form.leaderId && (
                    <span className="text-blue-400 ml-1">
                      · 已篩選 {leaderAreas.length} 個可選區域
                    </span>
                  )}
                </label>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-mc-card border border-white/10 p-2 space-y-0.5">
                  {leaderAreas.map(a => {
                    const selected = form.areaIds.includes(a.id)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAreaSelection(a.id)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-sm transition-colors ${
                          selected
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-mc-text/60 hover:bg-mc-accent'
                        }`}
                      >
                        <span className="font-mono">{a.name}</span>
                        <span className="text-xs text-mc-text/30">{a.assignedTo ? `→ ${a.assignedTo}` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-mc-text/50 mb-1">備註</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/60" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
              <button onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 rounded-lg text-mc-text/60 hover:text-mc-text text-sm transition-colors">
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !form.date}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingId ? '更新' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400">{error}</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20 text-mc-text/30">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無行程，點「新增行程」開始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const expanded = expandedId === s.id
            const completed = s.scheduleAreas.filter(sa => sa.completed).length
            const total = s.scheduleAreas.length
            const allDone = total > 0 && completed === total

            return (
              <div key={s.id} className={`bg-mc-card border rounded-xl overflow-hidden transition-all ${
                s.status === 'completed' || allDone ? 'border-green-500/30' :
                s.status === 'cancelled' ? 'border-red-500/30 opacity-60' :
                'border-white/5'
              }`}>
                {/* Card header — matches Sheet format */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-mc-accent/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <div className="mt-0.5">
                    {expanded
                      ? <ChevronDown className="w-5 h-5 text-mc-text/40" />
                      : <ChevronRight className="w-5 h-5 text-mc-text/40" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-mc-text">{formatDate(s.date)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-mc-accent text-mc-text/60">{getTimeSlotLabel(s.timeSlot)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{s.group}</span>
                      {allDone && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">✓ 全數完成</span>}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-mc-text/50 flex-wrap">
                      {s.timeStart && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {s.timeStart}{s.timeEnd ? ` ｜ ${s.timeEnd}` : ''}
                        </span>
                      )}
                      {s.leader && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {s.leader.name}
                        </span>
                      )}
                      {s.preMeetingType && (
                        <span className="flex items-center gap-1">
                          {s.preMeetingType === 'zoom' ? <Video className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          {s.preMeetingTime ? `${s.preMeetingTime} ` : ''}{s.preMeetingType}
                        </span>
                      )}
                      {s.meetingLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {s.meetingLocation}
                        </span>
                      )}
                    </div>

                    {total > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-mc-accent overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${(completed / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-mc-text/40 font-mono">{completed}/{total}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg text-mc-text/40 hover:text-mc-text hover:bg-mc-accent transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-mc-text/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: area completion */}
                {expanded && total > 0 && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="border-t border-white/5 pt-3 space-y-1">
                      <h4 className="text-xs font-semibold text-mc-text/50 mb-2">區域完成回報</h4>
                      {s.scheduleAreas.map(sa => (
                        <div key={sa.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-mc-accent/30 hover:bg-mc-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleComplete(sa)}
                              disabled={reporting === sa.id}
                              className="text-mc-text/40 hover:text-mc-text transition-colors disabled:opacity-50"
                            >
                              {sa.completed
                                ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                                : <Circle className="w-5 h-5" />}
                            </button>
                            <span className={`text-sm font-mono ${sa.completed ? 'text-mc-text/40 line-through' : 'text-mc-text'}`}>
                              {sa.area.name}
                            </span>
                          </div>
                          <span className="text-xs text-mc-text/30">
                            {sa.completedAt ? `✓ ${new Date(sa.completedAt).toLocaleDateString('zh-TW')}` : '待完成'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expanded && total === 0 && (
                  <div className="px-4 pb-4">
                    <div className="border-t border-white/5 pt-3 text-xs text-mc-text/30">
                      此行程未分配區域。點編輯加入。
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
