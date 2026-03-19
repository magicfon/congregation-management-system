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
  areaPolygonsFile: string // 从 JSON 文件加载
}

interface AreaData {
  id: number
  center: [number, number]
  polygon: [number, number][]
  pixelCount?: number
}

// Map configurations with polygon file
const MAP_CONFIGS: MapConfig[] = [
  {
    id: 'nanzih',
    name: '楠梓區',
    range: '1-89',
    image: '/maps/nanzih-1-89.png',
    bounds: [[0, 0], [5512, 7884]], // 实际尺寸：[height, width]
    areaPolygonsFile: '/maps/nanzih-areas-with-polygons.json'
  },
  {
    id: 'chiaotou',
    name: '橋頭',
    range: '90-148',
    image: '/maps/chiaotou-90-148.png',
    bounds: [[0, 0], [4534, 4827]], // 实际尺寸
    areaPolygonsFile: '/maps/chiaotou-areas-with-polygons.json'
  },
  {
    id: 'tzuguan',
    name: '梓官',
    range: '149-213',
    image: '/maps/tzuguan-149-213.png',
    bounds: [[0, 0], [4038, 4828]], // 实际尺寸
    areaPolygonsFile: '/maps/tzuguan-areas-with-polygons.json'
  }
]

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
  onAreaClick,
  areaData
}: {
  mapConfig: MapConfig
  areaStats: Map<string, IdleStat>
  filterStatus: string
  sortBy: string
  onAreaClick: (stat: IdleStat) => void
  areaData: Map<number, AreaData>
}) {
  const [L, setL] = useState<any>(null)

  useEffect(() => {
    import('leaflet').then(leaflet => {
      setL(leaflet.default)
    })
  }, [])

  const filteredAreas = useMemo(() => {
    if (!areaData || areaData.size === 0) return []

    const entries = Array.from(areaData.entries()).map(([id, data]) => {
      const stat = areaStats.get(id.toString())
      if (!stat) return null
      return { id, data, stat }
    }).filter(Boolean)

    // Apply filter
    if (filterStatus === 'all') {
      // No filter
    } else {
      entries = entries.filter(([, , stat]) => stat.status === filterStatus)
    }

    // Apply sort
    entries.sort(([idA, , statA], [idB, , statB]) => {
      switch (sortBy) {
        case 'idleDays':
          return statB.idleDays - statA.idleDays
        case 'name':
          return statA.areaName.localeCompare(statB.areaName, 'zh-TW')
        default:
          return parseInt(idA) - parseInt(idB)
      }
    })

    return entries
  }, [areaData, areaStats, filterStatus, sortBy])

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
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      style={{ height: '600px', width: '100%', background: '#0f0f1e' }}
    >
      <ImageOverlay
        url={mapConfig.image}
        bounds={mapConfig.bounds}
        opacity={1}
      />

      {filteredAreas.map(([id, data, stat]) => {
        const color = statusColors[stat.status]

        return (
          <Polygon
            key={id}
            positions={data.polygon}
            pathOptions={{
              color: color.border,
              weight: 3,
              opacity: 0.8,
              fill: color.bg,
              fillOpacity: 0.3
            }}
            eventHandlers={{
              click: () => onAreaClick(stat),
              mouseover: (e) => {
                e.target.openPopup()
              }
            }}
          >
            <Tooltip>
              <div className="bg-mc-bg border border-white/10 rounded-lg p-3 shadow-xl min-w-[200px]">
                <div className="font-bold text-mc-text mb-2">
                  {data.id}: {stat.areaName}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-mc-text/60">狀態：</span>
                    <span className="text-mc-text">
                      {color.emoji} {color.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mc-text/60">閒置：</span>
                    <span className={`text-${color.border.split('-')[1]}-400`}>
                      {stat.idleDays} 天
                    </span>
                  </div>
                  {stat.assignedTo && (
                    <div className="flex items-center gap-2">
                      <span className="text-mc-text/60">負責人：</span>
                      <span className="text-mc-text">{stat.assignedTo}</span>
                    </div>
                  )}
                  {stat.lastActivityAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-mc-text/60">最後活動：</span>
                      <span className="text-mc-text">
                        {new Date(stat.lastActivityAt).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Tooltip>
            <Popup>
              <div className="p-4 bg-mc-bg text-mc-text min-w-[250px]">
                <h3 className="font-bold text-lg mb-3">
                  區域 {data.id}: {stat.areaName}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-mc-text/60">狀態</span>
                    <span className="flex items-center gap-2">
                      <span>{color.emoji}</span>
                      <span className={`text-${color.border.split('-')[1]}-400`}>
                        {color.label}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mc-text/60">閒置天數</span>
                    <span className="font-semibold">{stat.idleDays}</span>
                  </div>
                  {stat.assignedTo && (
                    <div className="flex items-center justify-between">
                      <span className="text-mc-text/60">負責人</span>
                      <span className="font-semibold">{stat.assignedTo}</span>
                    </div>
                  )}
                  {stat.lastActivityAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-mc-text/60">最後活動</span>
                      <span className="font-semibold">
                        {new Date(stat.lastActivityAt).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 mt-3 border-t border-white/10">
                    <button
                      onClick={() => {
                        // TODO: 导航到区域详情页
                        console.log('导航到区域', data.id)
                      }}
                      className="w-full px-4 py-2 bg-mc-accent text-mc-text rounded-lg hover:bg-mc-accent/80 transition"
                    >
                      查看詳細信息
                    </button>
                  </div>
                </div>
              </Popup>
          </Polygon>
        )
      })}
    </MapContainer>
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
  const [areaData, setAreaData] = useState<Map<number, AreaData>>(new Map())

  // Load area polygons from JSON file
  useEffect(() => {
    setIsClient(true)

    const currentMap = MAP_CONFIGS[selectedMap]

    // Load polygon data
    fetch(currentMap.areaPolygonsFile)
      .then(res => res.json())
      .then(data => {
        const map = new Map<number, AreaData>()
        data.areas.forEach((area: AreaData) => {
          map.set(area.id, area)
        })
        setAreaData(map)
      })
      .catch(err => {
        console.error('加载区域数据失败:', err)
      })
  }, [selectedMap])

  // Load stats
  useEffect(() => {
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

  // Calculate status counts
  const statusCounts = useMemo(() => {
    return {
      green: stats.filter(s => s.status === 'green').length,
      yellow: stats.filter(s => s.status === 'yellow').length,
      orange: stats.filter(s => s.status === 'orange').length,
      red: stats.filter(s => s.status === 'red').length
    }
  }, [stats])

  const handleAreaClick = useCallback((stat: IdleStat) => {
    setSelectedArea(stat)
    // TODO: Show details or navigate
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg text-mc-text">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 w-16 h-16 text-red-500" />
          <p className="text-lg mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/80 transition"
          >
            重新載入
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-mc-accent border-t-transparent"></div>
        <p className="ml-4 text-mc-text">載入中...</p>
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
            <p className="text-mc-text/50 text-sm mt-1">
              基於檢測邊界線的實際區域形狀
            </p>
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

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-mc-accent/20 hover:bg-mc-accent/40 text-mc-text rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            篩選
          </button>

          <button
            onClick={() => {
              const nextSort = SORT_OPTIONS[(SORT_OPTIONS.findIndex(opt => opt.value === sortBy) + 1) % SORT_OPTIONS.length].value
              setSortBy(nextSort)
            }}
            className="px-4 py-2 bg-mc-accent/20 hover:bg-mc-accent/40 text-mc-text rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <ArrowUpDown className="w-4 h-4" />
            {SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}
          </button>
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border-2 ${
                  filterStatus === option.value
                    ? option.value === 'all'
                      ? 'bg-mc-accent text-white border-mc-accent'
                      : `bg-${option.color.split('-')[1]}-500 text-white border-${option.color.split('-')[1]}-500`
                    : 'border-transparent hover:border-white/10 bg-mc-accent/20 text-mc-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {MAP_CONFIGS.map((config, index) => (
          <button
            key={config.id}
            onClick={() => setSelectedMap(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedMap === index
                ? 'bg-mc-accent text-white'
                : 'bg-mc-card hover:bg-mc-accent/20 text-mc-text border border-white/5'
            }`}
          >
            {config.name} ({config.range})
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <LeafletMapContent
          mapConfig={MAP_CONFIGS[selectedMap]}
          areaStats={new Map(stats.map(stat => [stat.areaId, stat]))}
          filterStatus={filterStatus}
          sortBy={sortBy}
          onAreaClick={handleAreaClick}
          areaData={areaData}
        />
      </div>

      {/* Selected Area Details */}
      {selectedArea && (
        <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-mc-text mb-4">
            選中的區域：{selectedArea.areaName}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-mc-text/60 mb-1">狀態</div>
              <div className={`flex items-center gap-2 text-${statusColors[selectedArea.status].border.split('-')[1]}-400`}>
                <span>{statusColors[selectedArea.status].emoji}</span>
                <span>{statusColors[selectedArea.status].label}</span>
              </div>
            </div>
            <div>
              <div className="text-mc-text/60 mb-1">閒置天數</div>
              <div className="font-semibold">{selectedArea.idleDays} 天</div>
            </div>
            <div>
              <div className="text-mc-text/60 mb-1">負責人</div>
              <div>{selectedArea.assignedTo || '未指定'}</div>
            </div>
            <div>
              <div className="text-mc-text/60 mb-1">最後活動</div>
              <div>{selectedArea.lastActivityAt ? new Date(selectedArea.lastActivityAt).toLocaleDateString('zh-TW') : '無記錄'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <h3 className="text-sm font-semibold text-mc-text mb-3">顏色說明</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusColors).map(([status, config]) => (
            <div key={status} className="flex items-center gap-2 text-sm">
              <span className={`w-4 h-4 rounded-full bg-${config.border.split('-')[1]}-500`}></span>
              <div>
                <div className="font-medium text-mc-text">{config.label}</div>
                <div className="text-mc-text/50">{config.emoji}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
