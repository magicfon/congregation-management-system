'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Filter, ArrowUpDown, AlertCircle } from 'lucide-react'
import { Map as MapIcon } from 'lucide-react'

// Dynamically import Leaflet components (no SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
)
const ImageOverlay = dynamic(
  () => import('react-leaflet').then(mod => mod.ImageOverlay),
  { ssr: false }
)
const Polygon = dynamic(
  () => import('react-leaflet').then(mod => mod.Polygon),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import('react-leaflet').then(mod => mod.Tooltip),
  { ssr: false }
)

interface IdleStat {
  areaId: string
  areaName: string
  idleDays: number
  status: 'green' | 'yellow' | 'orange' | 'red'
  assignedTo: string | null
  lastActivityAt: string | null
}

interface MapConfig {
  id: string
  name: string
  range: string
  image: string
  bounds: [[number, number], [number, number]]
  areaPolygons: Record<string, [number, number][]>
}

// Map configurations with polygon coordinates for each area
const MAP_CONFIGS: MapConfig[] = [
  {
    id: 'nanzih',
    name: '楠梓區',
    range: '1-89',
    image: '/maps/nanzih-1-89.svg',
    bounds: [[0, 0], [1000, 1000]],
    areaPolygons: generateGridPolygons(1, 89, 10, 9)
  },
  {
    id: 'chiaotou',
    name: '橋頭',
    range: '90-148',
    image: '/maps/chiaotou-90-148.svg',
    bounds: [[0, 0], [1000, 1000]],
    areaPolygons: generateGridPolygons(90, 148, 8, 8)
  },
  {
    id: 'tzuguan',
    name: '梓官',
    range: '149-213',
    image: '/maps/tzuguan-149-213.svg',
    bounds: [[0, 0], [1000, 1000]],
    areaPolygons: generateGridPolygons(149, 213, 10, 7)
  }
]

// Generate grid-based polygons for areas
function generateGridPolygons(
  startId: number,
  endId: number,
  cols: number,
  rows: number
): Record<string, [number, number][]> {
  const polygons: Record<string, [number, number][]> = {}
  const cellWidth = 1000 / cols
  const cellHeight = 1000 / rows
  const padding = 20

  let currentId = startId
  for (let row = 0; row < rows && currentId <= endId; row++) {
    for (let col = 0; col < cols && currentId <= endId; col++) {
      const x1 = col * cellWidth + padding
      const y1 = row * cellHeight + padding
      const x2 = (col + 1) * cellWidth - padding
      const y2 = (row + 1) * cellHeight - padding

      polygons[currentId.toString()] = [
        [y1, x1],
        [y1, x2],
        [y2, x2],
        [y2, x1]
      ]
      currentId++
    }
  }

  return polygons
}

// Status color configuration
const statusColors = {
  green: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', label: '活躍', emoji: '🟢' },
  yellow: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.2)', label: '稍久未活動', emoji: '🟡' },
  orange: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: '久未活動', emoji: '🟠' },
  red: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', label: '嚴重閒置', emoji: '🔴' }
}

// Filter options
const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'green', label: '活躍 (<7天)', color: '#10b981' },
  { value: 'yellow', label: '稍久 (7-30天)', color: '#eab308' },
  { value: 'orange', label: '久未 (30-90天)', color: '#f97316' },
  { value: 'red', label: '嚴重 (>90天)', color: '#ef4444' }
]

// Sort options
const SORT_OPTIONS = [
  { value: 'id', label: '區域編號' },
  { value: 'idleDays', label: '閒置天數' },
  { value: 'name', label: '區域名稱' }
]

// Client-only Leaflet map component
function LeafletMapContent({
  mapConfig,
  areaStats,
  filterStatus,
  sortBy,
  onAreaClick
}: {
  mapConfig: MapConfig
  areaStats: Map<string, IdleStat>
  filterStatus: string
  sortBy: string
  onAreaClick: (stat: IdleStat) => void
}) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    import('leaflet').then(leaflet => {
      setL(leaflet.default)
    })
  }, [])

  const filteredPolygons = useMemo(() => {
    const entries = Object.entries(mapConfig.areaPolygons)
    
    let filtered = entries.filter(([areaId, _coords]) => {
      const stat = areaStats.get(areaId)
      if (!stat) return false
      if (filterStatus === 'all') return true
      return stat.status === filterStatus
    })

    // Sort
    filtered.sort(([idA], [idB]) => {
      const statA = areaStats.get(idA)
      const statB = areaStats.get(idB)
      
      if (!statA || !statB) return 0
      
      switch (sortBy) {
        case 'idleDays':
          return statB.idleDays - statA.idleDays
        case 'name':
          return statA.areaName.localeCompare(statB.areaName, 'zh-TW')
        default:
          return parseInt(idA) - parseInt(idB)
      }
    })

    return filtered
  }, [mapConfig.areaPolygons, areaStats, filterStatus, sortBy])

  if (!L) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-mc-card border border-white/5 rounded-xl">
        <div className="text-mc-text/50">載入地圖中...</div>
      </div>
    )
  }

  return (
    <MapContainer
      bounds={mapConfig.bounds}
      maxBounds={mapConfig.bounds}
      crs={L.CRS.Simple}
      style={{ height: '600px', width: '100%', backgroundColor: '#1a1a2e' }}
      className="rounded-xl overflow-hidden"
      zoomControl={true}
      attributionControl={false}
    >
      <ImageOverlay
        url={mapConfig.image}
        bounds={mapConfig.bounds}
      />
      
      {filteredPolygons.map(([areaId, coords]) => {
        const stat = areaStats.get(areaId)
        if (!stat) return null
        
        const colorConfig = statusColors[stat.status]
        
        return (
          <Polygon
            key={areaId}
            positions={coords}
            pathOptions={{
              color: colorConfig.border,
              weight: 3,
              opacity: 0.9,
              fillColor: colorConfig.border,
              fillOpacity: 0.3
            }}
            eventHandlers={{
              click: () => onAreaClick(stat)
            }}
          >
            <Tooltip direction="center" offset={[0, 0]} opacity={1} permanent={false}>
              <div className="text-center">
                <div className="font-medium">#{areaId} {stat.areaName}</div>
                <div className="text-sm opacity-80">閒置 {stat.idleDays} 天</div>
              </div>
            </Tooltip>
            <Popup>
              <div className="min-w-[200px]">
                <div className="font-semibold text-lg mb-2">#{areaId} {stat.areaName}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">狀態</span>
                    <span style={{ color: colorConfig.border }}>{colorConfig.emoji} {colorConfig.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">閒置天數</span>
                    <span className="font-medium">{stat.idleDays} 天</span>
                  </div>
                  {stat.assignedTo && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">負責人</span>
                      <span>{stat.assignedTo}</span>
                    </div>
                  )}
                  {stat.lastActivityAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">最後活動</span>
                      <span>{new Date(stat.lastActivityAt).toLocaleDateString('zh-TW')}</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Polygon>
        )
      })}
    </MapContainer>
  )
}

// Area detail modal
function AreaDetailModal({
  stat,
  onClose
}: {
  stat: IdleStat | null
  onClose: () => void
}) {
  if (!stat) return null

  const colorConfig = statusColors[stat.status]

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-mc-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-mc-text">
            區域詳情 #{stat.areaId}
          </h2>
          <button
            onClick={onClose}
            className="text-mc-text/40 hover:text-mc-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-mc-text">{stat.areaName}</div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm mt-2"
              style={{ backgroundColor: colorConfig.bg, color: colorConfig.border }}
            >
              {colorConfig.emoji} {colorConfig.label}
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-mc-text/50">區域 ID</span>
              <span className="text-mc-text font-mono">{stat.areaId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-mc-text/50">閒置天數</span>
              <span className="text-mc-text font-medium">{stat.idleDays} 天</span>
            </div>
            {stat.assignedTo && (
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-mc-text/50">負責人</span>
                <span className="text-mc-text">{stat.assignedTo}</span>
              </div>
            )}
            {stat.lastActivityAt && (
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-mc-text/50">最後活動日期</span>
                <span className="text-mc-text">
                  {new Date(stat.lastActivityAt).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-sm transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

// Main component
export default function MapHeatmap() {
  const [stats, setStats] = useState<IdleStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMap, setSelectedMap] = useState(0)
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('id')
  const [selectedArea, setSelectedArea] = useState<IdleStat | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    fetch('/api/areas/idle-stats')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setStats(data)
        }
      })
      .catch(err => {
        setError('載入失敗')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Create a map for quick lookup
  const areaStatsMap = useMemo(() => {
    const map = new Map<string, IdleStat>()
    stats.forEach(stat => {
      // Try to match by areaId or extract number from name
      const numMatch = stat.areaName.match(/\d+/)
      if (numMatch) {
        map.set(numMatch[0], stat)
      }
      map.set(stat.areaId, stat)
    })
    return map
  }, [stats])

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    green: stats.filter(s => s.status === 'green').length,
    yellow: stats.filter(s => s.status === 'yellow').length,
    orange: stats.filter(s => s.status === 'orange').length,
    red: stats.filter(s => s.status === 'red').length
  }), [stats])

  // Filter stats for sidebar
  const filteredSidebarStats = useMemo(() => {
    let filtered = stats
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus)
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'idleDays':
          return b.idleDays - a.idleDays
        case 'name':
          return a.areaName.localeCompare(b.areaName, 'zh-TW')
        default:
          return a.areaId.localeCompare(b.areaId)
      }
    }).slice(0, 20)
  }, [stats, filterStatus, sortBy])

  const currentMapConfig = MAP_CONFIGS[selectedMap]

  if (!isClient) {
    return (
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/4"></div>
            <div className="h-96 bg-white/5 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/4"></div>
            <div className="h-96 bg-white/5 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-mc-text flex items-center gap-2">
              <MapIcon className="w-5 h-5" />
              區域地圖熱力圖
            </h2>
            <p className="text-mc-text/50 text-sm mt-1">點擊區域查看詳情，使用過濾器篩選閒置狀態</p>
          </div>

          {/* Status Summary */}
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-mc-accent/50">
                <span>{statusColors[status as keyof typeof statusColors].emoji}</span>
                <span className="text-mc-text/60">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          {Object.entries(statusColors).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: config.border, backgroundColor: config.bg }}
              ></span>
              <span className="text-mc-text/60">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map Selector */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {MAP_CONFIGS.map((config, index) => (
            <button
              key={config.id}
              onClick={() => setSelectedMap(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedMap === index
                  ? 'bg-mc-highlight text-white border border-blue-500/30'
                  : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5 hover:border-white/10'
              }`}
            >
              {config.name} ({config.range})
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              showFilters || filterStatus !== 'all'
                ? 'bg-mc-highlight/20 text-blue-400 border border-blue-500/30'
                : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5'
            }`}
          >
            <Filter className="w-4 h-4" />
            過濾器
            {filterStatus !== 'all' && (
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            )}
          </button>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-mc-text/40" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-mc-accent border border-white/5 rounded-lg px-3 py-2 text-sm text-mc-text focus:outline-none focus:border-blue-500/40"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 ml-auto">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === opt.value
                    ? 'bg-mc-highlight text-white'
                    : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5'
                }`}
                style={opt.color && filterStatus === opt.value ? { backgroundColor: opt.color } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Extended Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(opt.value)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm transition-all ${
                    filterStatus === opt.value
                      ? 'bg-mc-highlight text-white'
                      : 'bg-mc-accent/50 text-mc-text/60 hover:text-mc-text border border-white/5'
                  }`}
                >
                  {opt.color && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    ></span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="bg-mc-card border border-white/5 rounded-xl overflow-hidden">
        {isClient && (
          <LeafletMapContent
            mapConfig={currentMapConfig}
            areaStats={areaStatsMap}
            filterStatus={filterStatus}
            sortBy={sortBy}
            onAreaClick={setSelectedArea}
          />
        )}
      </div>

      {/* Sidebar: Filtered Area List */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <h3 className="text-sm font-semibold text-mc-text mb-4">
          {filterStatus === 'all' ? '區域列表' : `${FILTER_OPTIONS.find(f => f.value === filterStatus)?.label}區域`}
          <span className="text-mc-text/40 font-normal ml-2">(前 20 筆)</span>
        </h3>
        
        {filteredSidebarStats.length === 0 ? (
          <p className="text-mc-text/50 text-sm">沒有符合條件的區域</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredSidebarStats.map(stat => {
              const config = statusColors[stat.status]
              return (
                <button
                  key={stat.areaId}
                  onClick={() => setSelectedArea(stat)}
                  className="text-left p-3 rounded-lg border transition-all hover:scale-105"
                  style={{
                    borderColor: config.border + '40',
                    backgroundColor: config.bg
                  }}
                >
                  <div className="text-sm font-medium text-mc-text truncate">{stat.areaName}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs" style={{ color: config.border }}>
                      {stat.idleDays}天
                    </span>
                    <span className="text-xs text-mc-text/40">· {config.emoji}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Area Detail Modal */}
      <AreaDetailModal stat={selectedArea} onClose={() => setSelectedArea(null)} />
    </div>
  )
}
