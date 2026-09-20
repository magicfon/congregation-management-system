'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AllocationArea, allocationLabel, DISTRICT_NAMES } from '../../lib/allocation'

type Member = { id: string; name: string }

export default function MapAllocationList() {
  const [areas, setAreas] = useState<AllocationArea[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [district, setDistrict] = useState('all')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [memberId, setMemberId] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const [areaRes, meRes, memberRes] = await Promise.all([
        fetch('/api/areas/allocation', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/members?active=true', { cache: 'no-store' }),
      ])
      if (!areaRes.ok || !meRes.ok || !memberRes.ok) throw new Error('清單載入失敗，請重新整理；若登入已失效，請重新登入。')
      const [data, user, memberList] = await Promise.all([areaRes.json(), meRes.json(), memberRes.json()])
      setAreas(data.areas)
      setSyncedAt(data.syncedAt)
      setIsAdmin(user.isAdmin === true)
      setMembers(memberList)
      setMemberId((current) => memberList.some((m: Member) => m.id === current) ? current : '')
    } catch (e) { setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => areas.filter((area) => {
    if (district !== 'all' && area.mapId !== district) return false
    if (onlyAvailable && area.isDispatched) return false
    const needle = query.trim().toLowerCase()
    return !needle || [allocationLabel(area), area.blockCode, area.assignedTo].some((value) => value?.toLowerCase().includes(needle))
  }), [areas, district, onlyAvailable, query])

  const selectedAreas = visible.filter((area) => selected.has(area.id) && !area.isDispatched)
  useEffect(() => {
    const allowed = new Set(visible.filter((area) => !area.isDispatched).map((area) => area.id))
    setSelected((previous) => {
      const next = new Set([...previous].filter((id) => allowed.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [visible])

  function toggle(ids: string[]) {
    if (busyRef.current) return
    setSelected((previous) => {
      const next = new Set(previous)
      const all = ids.every((id) => next.has(id))
      for (const id of ids) { if (all) next.delete(id); else next.add(id) }
      return next
    })
    setMessage('')
  }

  async function refreshDates() {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/areas/allocation', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '更新失敗')
      await load()
      setMessage(`回報日期已更新，${data.updated} 張日期有變動。`)
    } catch (e) { setError(e instanceof Error ? e.message : '更新失敗') }
    finally { busyRef.current = false; setBusy(false) }
  }

  async function dispatch() {
    const member = members.find((m) => m.id === memberId)
    if (!member || !selectedAreas.length || busyRef.current || loading || !isAdmin || error) return
    const selection = [...selectedAreas]
    if (!window.confirm(`將以下 ${selection.length} 張地圖分發給「${member.name}」？\n\n${selection.map(allocationLabel).join('、')}`)) return
    busyRef.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/areas/dispatch-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaIds: selection.map((area) => area.id), memberId, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '分發未完成，請重新整理確認狀態')
      setSelected(new Set()); setMemberId(''); setNote('')
      await load()
      setMessage(`已分發 ${data.assigned} 張給 ${member.name}。${data.sheetSynced ? '' : '資料庫已完成，Sheet 尚待同步，請勿重複分發。'}`)
    } catch (e) { setError(e instanceof Error ? e.message : '連線中斷，請重新整理確認分配狀態後再試') }
    finally { busyRef.current = false; setBusy(false) }
  }

  const available = areas.filter((area) => !area.isDispatched).length
  const disabled = loading || busy
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-mc-text/70">共 {areas.length} 張 · 可分發 {available} 張 · 使用中 {areas.length - available} 張</span>
        <div className="flex gap-2">
          <button type="button" disabled={disabled} onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs disabled:opacity-40">重新整理</button>
          {isAdmin && <button type="button" disabled={disabled} onClick={() => void refreshDates()} className="rounded-lg border border-blue-400/30 px-3 py-1.5 text-xs text-blue-300 disabled:opacity-40">更新回報日期</button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center rounded-xl border border-white/10 bg-mc-card p-2">
        <label className="sr-only" htmlFor="allocation-district">地區</label>
        <select id="allocation-district" value={district} disabled={disabled} onChange={(e) => setDistrict(e.target.value)} className="rounded-lg bg-mc-accent p-2 text-sm">
          <option value="all">全部地區</option>
          {Object.entries(DISTRICT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <input aria-label="搜尋地圖或持有人" placeholder="搜尋地圖或持有人" value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-mc-bg px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs text-mc-text/70"><input type="checkbox" checked={onlyAvailable} disabled={disabled} onChange={(e) => setOnlyAvailable(e.target.checked)} />只看可分發</label>
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-xs text-mc-text/50">
        <span>依區域順序排列 · <span className="text-yellow-300">90–179 天</span> · <span className="text-red-400">180 天以上</span></span>
        <span>{syncedAt ? `回報日期更新：${new Date(syncedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}` : '回報日期待首次同步'}</span>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-blue-300">{message}</p>}
      {!loading && !syncedAt && <p className="text-xs text-yellow-200">尚未匯入上次回報完成日期。{isAdmin ? '可點「更新回報日期」立即匯入。' : '請等候排程同步或由管理員更新。'}</p>}

      {isAdmin && selectedAreas.length > 0 && (
        <div className="sticky top-14 md:top-0 z-10 space-y-2 rounded-xl border border-blue-400/30 bg-mc-card p-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">已選 {selectedAreas.length} 張</span>
            <select aria-label="分發給成員" value={memberId} disabled={disabled} onChange={(e) => setMemberId(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-mc-accent p-2 text-sm">
              <option value="">選擇成員</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <button type="button" onClick={() => void dispatch()} disabled={disabled || !memberId || !!error} className="rounded-lg bg-mc-highlight px-3 py-2 text-sm text-white disabled:opacity-40">{busy ? '處理中…' : '一次分發'}</button>
            <button type="button" disabled={disabled} onClick={() => setSelected(new Set())} className="px-2 py-1 text-xs text-mc-text/60">取消選取</button>
          </div>
          <input aria-label="分配備註" maxLength={1000} placeholder="分配備註（選填）" value={note} disabled={disabled} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-white/10 bg-mc-bg px-3 py-1.5 text-xs" />
        </div>
      )}

      {loading ? <p role="status" className="py-10 text-center text-sm text-mc-text/60">載入地圖清單…</p> : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-mc-card">
          <table className="w-full text-left text-xs sm:text-sm leading-5">
            <caption className="sr-only">所有地圖依區域排序的最後回報完成日期、距今天數與分配狀態</caption>
            <thead className="text-xs text-mc-text/60">
              <tr>
                {isAdmin && <th scope="col" className="w-8"><span className="sr-only">選取</span></th>}
                <th scope="col" className="px-2 py-1">地圖</th>
                <th scope="col" className="hidden sm:table-cell px-2 py-1">上次回報完成</th>
                <th scope="col" className="px-2 py-1 text-right">距今</th>
                <th scope="col" className="px-2 py-1">分配狀態</th>
              </tr>
            </thead>
            <tbody className="border-t border-white/10">
                {visible.map((area) => <tr key={area.id} className={`border-t border-white/5 ${selected.has(area.id) ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'}`}>
                  {isAdmin && <td className="pl-2"><input type="checkbox" aria-label={`選取${allocationLabel(area)}`} checked={selected.has(area.id)} disabled={disabled || area.isDispatched || !!error} onChange={() => toggle([area.id])} className="h-4 w-4 accent-blue-500 disabled:opacity-25" /></td>}
                  <th scope="row" className="px-2 py-1 font-medium">
                    {area.sheetNo && area.sheetNo !== 2 ? <a href={`/maps/areas/${area.sheetNo}.jpg`} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-4" aria-label={`開啟${allocationLabel(area)}圖檔（新分頁）`}>{allocationLabel(area)}</a> : allocationLabel(area)}
                    <span className="sm:hidden block text-[11px] font-normal text-mc-text/50">{area.lastCompletedDate || (syncedAt ? '無回報紀錄' : '待同步')}</span>
                  </th>
                  <td className="hidden sm:table-cell px-2 py-1 text-mc-text/60">{area.lastCompletedDate || (syncedAt ? '無回報紀錄' : '待同步')}</td>
                  <td className={`px-2 py-1 text-right whitespace-nowrap tabular-nums ${area.idleDays === null ? 'text-mc-text/40' : area.idleDays >= 180 ? 'text-red-400' : area.idleDays >= 90 ? 'text-yellow-300' : 'text-mc-text'}`}>
                    {area.idleDays === null ? '—' : <><strong>{area.idleDays}</strong> 天</>}
                  </td>
                  <td className="px-2 py-1 max-w-28 break-words">{area.isDispatched ? <><span className="text-mc-text/50">使用中</span><span className="ml-1 text-xs">{area.assignedTo || '未知持有人'}</span></> : <span className="text-emerald-300">可分發</span>}</td>
                </tr>)}
            </tbody>
          </table>
          {!visible.length && <p className="py-10 text-center text-sm text-mc-text/50">{error ? '清單尚未載入' : '目前篩選條件沒有地圖'}</p>}
        </div>
      )}
    </div>
  )
}
