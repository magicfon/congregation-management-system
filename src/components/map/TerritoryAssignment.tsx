'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Search, Loader2, AlertCircle, Check, X, ChevronDown, ChevronRight } from 'lucide-react'

// Dynamically import the entire Leaflet map (all react-leaflet imports live in that file
// so the React Context is shared correctly between MapContainer and useMap/fitBounds)
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
    </div>
  ),
})

interface AreaFeature {
  id: number
  center: [number, number]
  polygon?: [number, number][] | null
}

interface MapData {
  mapId: string
  mapName: string
  range: string
  image: string
  imageSize: [number, number]
  bounds: [[number, number], [number, number]]
  totalAreas: number
  areas: AreaFeature[]
}
interface AreaAssignment {
  id: string
  name: string
  mapAreaId: number | null
  blockCode: string | null
  assignedMemberId: string | null
  assignedTo: string | null
  assignNote: string | null
  dispatchedAt: string | null
  completedAt: string | null
  isDispatched: boolean
}

interface Member {
  id: string
  name: string
}

const MAP_OPTIONS = [
  { id: 'nanzih', name: '楠梓區' },
  { id: 'chiaotou', name: '橋頭' },
  { id: 'tzuguan', name: '梓官' },
]

// ===== Block Group =====
interface BlockGroup {
  code: string
  areas: { area: AreaFeature; assignment: AreaAssignment | undefined }[]
}

export default function TerritoryAssignment() {
  const [selectedMapId, setSelectedMapId] = useState('nanzih')
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [assignments, setAssignments] = useState<Map<number, AreaAssignment>>(new Map())
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())

  useEffect(() => { setIsClient(true) }, [])

  useEffect(() => {
    if (!isClient) return
    fetch('/api/members')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMembers(data.map((m: any) => ({ id: m.id, name: m.name })))
      })
      .catch(() => {})
  }, [isClient])

  const loadMap = useCallback(async (mapId: string) => {
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())
    setMapData(null)

    try {
      const [mapRes, assignRes] = await Promise.all([
        fetch(`/api/maps/${mapId}`),
        fetch(`/api/areas/assign?mapId=${mapId}`),
      ])
      if (!mapRes.ok) throw new Error(`HTTP ${mapRes.status}`)
      const mapJson: MapData = await mapRes.json()
      setMapData(mapJson)

      if (assignRes.ok) {
        const json = await assignRes.json()
        const map = new Map<number, AreaAssignment>()
        for (const a of json.areas || []) {
          if (a.mapAreaId != null) map.set(a.mapAreaId, a)
        }
        setAssignments(map)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return
    loadMap(selectedMapId)
  }, [selectedMapId, isClient, loadMap])

  // Group areas by blockCode
  const blockGroups = useMemo<BlockGroup[]>(() => {
    if (!mapData) return []
    const groups: Record<string, BlockGroup> = {}

    for (const area of mapData.areas) {
      const a = assignments.get(area.id)
      const code = a?.blockCode || '未分組'
      if (!groups[code]) groups[code] = { code, areas: [] }
      groups[code].areas.push({ area, assignment: a })
    }

    return Object.values(groups).sort((a, b) => {
      // Sort: A-1, A-2... before special names
      const aIsCode = /^[A-C]-\d+$/.test(a.code)
      const bIsCode = /^[A-C]-\d+$/.test(b.code)
      if (aIsCode && bIsCode) return a.code.localeCompare(b.code, undefined, { numeric: true })
      if (aIsCode) return -1
      if (bIsCode) return 1
      return a.code.localeCompare(b.code)
    })
  }, [mapData, assignments])

  // Filtered blocks (search)
  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return blockGroups

    return blockGroups.map(g => ({
      ...g,
      areas: g.areas.filter(({ area, assignment }) => {
        const numMatch = area.id.toString().includes(q)
        const codeMatch = g.code.toLowerCase().includes(q)
        const nameMatch = assignment?.assignedTo?.toLowerCase().includes(q) ?? false
        return numMatch || codeMatch || nameMatch
      })
    })).filter(g => g.areas.length > 0)
  }, [blockGroups, searchQuery])

  const memberName = useCallback((id: string | null) => {
    if (!id) return null
    return members.find(m => m.id === id)?.name ?? null
  }, [members])

  function toggle(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectBlock(code: string, areas: BlockGroup['areas']) {
    const allIds = areas.map(a => a.area.id)
    const allSelected = allIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        allIds.forEach(id => next.delete(id))
      } else {
        allIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function toggleBlockExpand(code: string) {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function handleAssign() {
    if (!assignTo || selectedIds.size === 0) return
    setSaving(true)
    try {
      const promises = Array.from(selectedIds).map(areaId => {
        const a = assignments.get(areaId)
        if (!a) return null
        return fetch('/api/areas/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ areaId: a.id, memberId: assignTo, note: assignNote || undefined }),
        })
      }).filter(Boolean)

      await Promise.all(promises)
      await loadMap(selectedMapId)
      setSelectedIds(new Set())
      setAssignTo('')
      setAssignNote('')
    } catch (err) {
      console.error('Assign failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // Block-level status helpers
  function getBlockStatus(areas: BlockGroup['areas']): { dispatched: number; total: number; assignee: string | null; note: string | null } {
    const dispatchedAreas = areas.filter(a => a.assignment?.isDispatched)
    const assignee = dispatchedAreas[0]?.assignment?.assignedTo ?? null
    const note = dispatchedAreas[0]?.assignment?.assignNote ?? null
    const allSame = dispatchedAreas.every(a => a.assignment?.assignedTo === assignee)
    return {
      dispatched: dispatchedAreas.length,
      total: areas.length,
      assignee: allSame ? assignee : null,
      note: allSame ? note : null,
    }
  }

  const totalAssigned = useMemo(() => {
    let count = 0
    assignments.forEach(a => { if (a.isDispatched) count++ })
    return count
  }, [assignments])

  if (!isClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Map selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {MAP_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedMapId(opt.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selectedMapId === opt.id
                  ? 'bg-mc-highlight text-white'
                  : 'bg-mc-card text-mc-text/60 hover:text-mc-text border border-white/5'
              }`}
            >
              {opt.name}
            </button>
          ))}
        </div>
        {!loading && !error && (
          <span className="text-xs text-mc-text/40">
            已分配 {totalAssigned}/{assignments.size} 區
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-400 gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: Block list */}
          <div className="lg:col-span-2 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋區塊 / 編號 / 人名…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-mc-card border border-white/5 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/40 text-sm"
              />
            </div>

            {/* Block groups */}
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredBlocks.map(block => {
                const status = getBlockStatus(block.areas)
                const blockHasSelection = block.areas.some(a => selectedIds.has(a.area.id))
                const isExpanded = expandedBlocks.has(block.code) || blockHasSelection
                const blockSelectedIds = block.areas.map(a => a.area.id)
                const allBlockSelected = blockSelectedIds.every(id => selectedIds.has(id))
                const someBlockSelected = blockSelectedIds.some(id => selectedIds.has(id))
                const isFullyAssigned = status.dispatched === status.total
                const isPartiallyAssigned = status.dispatched > 0 && status.dispatched < status.total

                return (
                  <div
                    key={block.code}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      someBlockSelected
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : isFullyAssigned
                          ? 'border-indigo-500/20 bg-mc-card'
                          : 'border-white/5 bg-mc-card'
                    }`}
                  >
                    {/* Block header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      {/* Block checkbox */}
                      <button
                        onClick={() => selectBlock(block.code, block.areas)}
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                          allBlockSelected
                            ? 'bg-blue-500 text-white'
                            : someBlockSelected
                              ? 'bg-blue-500/30 text-blue-400'
                              : 'bg-mc-accent text-mc-text/50 hover:text-mc-text'
                        }`}
                      >
                        {allBlockSelected ? <Check className="w-4 h-4" /> : block.areas.length}
                      </button>

                      {/* Block code */}
                      <button
                        onClick={() => toggleBlockExpand(block.code)}
                        className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-mc-text/40 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-mc-text/40 flex-shrink-0" />}
                        <span className={`text-sm font-bold flex-shrink-0 ${
                          isFullyAssigned ? 'text-indigo-300' : 'text-mc-text'
                        }`}>
                          {block.code}
                        </span>
                        {/* Assignee badge */}
                        {status.assignee && (
                          <span className="text-xs text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded truncate">
                            {status.assignee}
                          </span>
                        )}
                        {status.note && (
                          <span className="text-xs text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={status.note}>
                            {status.note}
                          </span>
                        )}
                        {isPartiallyAssigned && !status.assignee && (
                          <span className="text-xs text-amber-400">
                            部分分配
                          </span>
                        )}
                      </button>

                      {/* Status dots */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {block.areas.map(({ area, assignment }) => {
                          const sel = selectedIds.has(area.id)
                          const assigned = !!assignment?.isDispatched
                          return (
                            <button
                              key={area.id}
                              onClick={() => toggle(area.id)}
                              className={`w-5 h-5 rounded text-[10px] font-mono font-bold transition-all ${
                                sel
                                  ? 'bg-blue-500 text-white scale-110'
                                  : assigned
                                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                                    : 'bg-mc-accent text-mc-text/40 hover:text-mc-text'
                              }`}
                              title={`#${area.id} ${assignment?.assignedTo ?? ''}`}
                            >
                              {area.id}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-0 space-y-1 border-t border-white/5">
                        {block.areas.map(({ area, assignment }) => {
                          const sel = selectedIds.has(area.id)
                          const assigned = !!assignment?.isDispatched
                          return (
                            <div
                              key={area.id}
                              className={`flex items-center gap-2 py-1 px-1.5 rounded text-xs ${
                                sel ? 'bg-blue-500/10' : ''
                              }`}
                            >
                              <button onClick={() => toggle(area.id)} className="flex-shrink-0">
                                {sel
                                  ? <Check className="w-3.5 h-3.5 text-blue-400" />
                                  : <div className={`w-3.5 h-3.5 rounded ${assigned ? 'bg-indigo-400' : 'bg-gray-600'}`} />}
                              </button>
                              <span className="font-mono font-bold text-mc-text/60 w-6">#{area.id}</span>
                              <span className={`flex-1 truncate ${assigned ? 'text-indigo-300' : 'text-mc-text/30'}`}>
                                {assignment?.isDispatched
                                  ? (assignment?.assignedTo ?? '未分配')
                                  : (assignment?.assignedTo ? `${assignment.assignedTo}（已收回）` : '未分配')}
                              </span>
                              {assignment?.assignNote && (
                                <span className="text-xs text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={assignment.assignNote}>
                                  {assignment.assignNote}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {filteredBlocks.length === 0 && (
                <div className="text-center py-8 text-mc-text/30 text-sm">找不到</div>
              )}
            </div>
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-3 hidden lg:block">
            <div className="bg-mc-card border border-white/5 rounded-xl overflow-hidden h-[595px] sticky top-4">
              {mapData && (
                <LeafletMap
                  mapData={mapData}
                  selectedIds={selectedIds}
                  assignments={assignments}
                  onToggle={toggle}
                />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-mc-text/40">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> 已選取
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500/40" /> 已分配
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-gray-600" /> 未分配
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar: assign */}
      {selectedIds.size > 0 && !loading && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-mc-bg/95 backdrop-blur border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <span className="text-xs text-mc-text/50 whitespace-nowrap">已選：</span>
                {Array.from(selectedIds).sort((a, b) => a - b).map(id => (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-mono hover:bg-red-500/20 hover:text-red-400"
                  >
                    {id}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-mc-text/50 whitespace-nowrap">分配給</span>
                <select
                  value={assignTo}
                  onChange={e => setAssignTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm focus:outline-none focus:border-blue-500/40"
                >
                  <option value="">選擇人員</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <input
                  value={assignNote}
                  onChange={e => setAssignNote(e.target.value)}
                  placeholder="目的（選填）"
                  className="px-3 py-1.5 rounded-lg bg-mc-card border border-white/10 text-mc-text text-sm placeholder-mc-text/30 focus:outline-none focus:border-blue-500/40 w-32"
                />
                <button
                  onClick={handleAssign}
                  disabled={!assignTo || saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  確認
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2 py-1.5 text-mc-text/40 hover:text-mc-text text-sm"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
          <div className="h-20" />
        </>
      )}
    </div>
  )
}
