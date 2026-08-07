'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Search, Eye, EyeOff, Hash, MapPin, Loader2, AlertCircle } from 'lucide-react'

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
const Tooltip = dynamic(
  () => import('react-leaflet').then(mod => mod.Tooltip),
  { ssr: false }
)

interface AreaFeature {
  id: number
  center: [number, number]
  polygon: [number, number][]
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

const MAP_OPTIONS = [
  { id: 'nanzih', name: '楠梓區', range: '1-89' },
  { id: 'chiaotou', name: '橋頭', range: '90-148' },
  { id: 'tzuguan', name: '梓官', range: '149-213' },
]

// Convert polygon from [x, y] (image) to [y, x] (Leaflet CRS.Simple)
function convertPolygon(polygon: [number, number][]): [number, number][] {
  return polygon.map(([x, y]) => [y, x])
}

const SELECTED_COLOR = { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.35)' }
const DEFAULT_COLOR = { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' }

function MapCanvas({
  mapData,
  showPolygon,
  showLabels,
  selectedAreaId,
  onSelectArea,
}: {
  mapData: MapData | null
  showPolygon: boolean
  showLabels: boolean
  selectedAreaId: number | null
  onSelectArea: (id: number) => void
}) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    import('leaflet').then(leaflet => {
      setL(leaflet.default)
    })
  }, [])

  if (!mapData) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-mc-card border border-white/5 rounded-xl">
        <Loader2 className="w-6 h-6 text-mc-text/30 animate-spin" />
      </div>
    )
  }

  if (!L) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-mc-card border border-white/5 rounded-xl">
        <div className="text-mc-text/50">載入地圖引擎中...</div>
      </div>
    )
  }

  return (
    <MapContainer
      bounds={mapData.bounds}
      maxBounds={mapData.bounds}
      crs={L.CRS.Simple}
      style={{ height: '600px', width: '100%', backgroundColor: '#1a1a2e' }}
      className="rounded-xl overflow-hidden"
      zoomControl={true}
      attributionControl={false}
    >
      <ImageOverlay
        url={mapData.image}
        bounds={mapData.bounds}
      />

      {showPolygon && mapData.areas.map((area) => {
        const isSelected = area.id === selectedAreaId
        const color = isSelected ? SELECTED_COLOR : DEFAULT_COLOR
        return (
          <Polygon
            key={area.id}
            positions={convertPolygon(area.polygon)}
            pathOptions={{
              color: color.border,
              weight: isSelected ? 3 : 1.5,
              opacity: isSelected ? 1 : 0.7,
              fillColor: color.border,
              fillOpacity: isSelected ? 0.35 : 0.1,
            }}
            eventHandlers={{
              click: () => onSelectArea(area.id),
            }}
          >
            {showLabels && (
              <Tooltip direction="center" offset={[0, 0]} opacity={0.9} permanent>
                <span style={{ fontSize: '10px', fontWeight: 600 }}>{area.id}</span>
              </Tooltip>
            )}
          </Polygon>
        )
      })}
    </MapContainer>
  )
}

export default function MapManager() {
  const [selectedMapId, setSelectedMapId] = useState('nanzih')
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPolygon, setShowPolygon] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const loadMap = useCallback(async (mapId: string) => {
    setLoading(true)
    setError(null)
    setSelectedAreaId(null)
    setMapData(null)

    try {
      const res = await fetch(`/api/maps/${mapId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: MapData = await res.json()
      setMapData(data)
    } catch (err) {
      console.error('Failed to load map:', err)
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return
    loadMap(selectedMapId)
  }, [selectedMapId, isClient, loadMap])

  // Selected area detail
  const selectedArea = useMemo(() => {
    if (!mapData || selectedAreaId === null) return null
    return mapData.areas.find(a => a.id === selectedAreaId) ?? null
  }, [mapData, selectedAreaId])

  // Search filtered areas
  const filteredAreas = useMemo(() => {
    if (!mapData) return []
    if (!searchQuery.trim()) return mapData.areas
    const q = searchQuery.trim().toLowerCase()
    return mapData.areas.filter(a =>
      a.id.toString() === q ||
      a.id.toString().includes(q)
    )
  }, [mapData, searchQuery])

  const handleSearchSelect = (id: number) => {
    setSelectedAreaId(id)
  }

  if (!isClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span className="text-mc-text/50">目前地圖：</span>
            <span className="text-mc-text font-medium">
              {mapData ? `${mapData.mapName}（${mapData.range}）` : '—'}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-mc-text/50">區域數：</span>
            <span className="text-mc-text font-medium">
              {mapData ? mapData.totalAreas : '—'}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-mc-text/50">狀態：</span>
            {loading ? (
              <span className="text-mc-warning flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 載入中
              </span>
            ) : error ? (
              <span className="text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </span>
            ) : (
              <span className="text-emerald-400">● 就緒</span>
            )}
          </div>
        </div>
      </div>

      {/* Map selector */}
      <div className="bg-mc-card border border-white/5 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {MAP_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedMapId(opt.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedMapId === opt.id
                  ? 'bg-mc-highlight text-white border border-blue-500/30'
                  : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5 hover:border-white/10'
              }`}
            >
              {opt.name}（{opt.range}）
            </button>
          ))}
        </div>

        {/* Toggle controls */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/5">
          <button
            onClick={() => setShowPolygon(!showPolygon)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showPolygon
                ? 'bg-mc-highlight/20 text-blue-400 border border-blue-500/30'
                : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5'
            }`}
          >
            {showPolygon ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            顯示區域框線
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showLabels
                ? 'bg-mc-highlight/20 text-blue-400 border border-blue-500/30'
                : 'bg-mc-accent text-mc-text/60 hover:text-mc-text border border-white/5'
            }`}
          >
            {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <Hash className="w-3 h-3" />
            顯示編號
          </button>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center bg-mc-card border border-white/5 rounded-xl">
              <Loader2 className="w-8 h-8 text-mc-text/30 animate-spin" />
            </div>
          ) : error ? (
            <div className="h-[600px] flex items-center justify-center bg-mc-card border border-white/5 rounded-xl">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          ) : (
            <div className="bg-mc-card border border-white/5 rounded-xl overflow-hidden">
              <MapCanvas
                mapData={mapData}
                showPolygon={showPolygon}
                showLabels={showLabels}
                selectedAreaId={selectedAreaId}
                onSelectArea={setSelectedAreaId}
              />
            </div>
          )}
        </div>

        {/* Side panel: detail + search */}
        <div className="lg:col-span-1 space-y-4">
          {/* Selected area detail */}
          <div className="bg-mc-card border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-mc-text mb-3">區域詳情</h3>
            {selectedArea ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-mc-text/50">編號</span>
                  <span className="text-mc-text font-mono font-medium">#{selectedArea.id}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-mc-text/50">所屬地圖</span>
                  <span className="text-mc-text">{mapData?.mapName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-mc-text/50">中心點 (x, y)</span>
                  <span className="text-mc-text font-mono text-xs">
                    {Math.round(selectedArea.center[0])}, {Math.round(selectedArea.center[1])}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-mc-text/50">邊界節點</span>
                  <span className="text-mc-text">{selectedArea.polygon.length}</span>
                </div>
                <button
                  onClick={() => setSelectedAreaId(null)}
                  className="w-full mt-2 py-2 rounded-lg border border-white/10 text-mc-text/60 hover:text-mc-text hover:bg-mc-accent text-xs transition-colors"
                >
                  取消選取
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-mc-text/30 text-xs">
                點選地圖上的區域查看詳情
              </div>
            )}
          </div>

          {/* Search */}
          <div className="bg-mc-card border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-mc-text mb-3">搜尋區域</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="輸入區域編號…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-mc-accent border border-white/5 text-mc-text placeholder-mc-text/30 focus:outline-none focus:border-blue-500/40 transition-colors text-sm"
              />
            </div>

            {/* Search results */}
            <div className="max-h-[280px] overflow-y-auto space-y-1">
              {filteredAreas.length === 0 ? (
                <div className="text-center py-4 text-mc-text/30 text-xs">
                  {searchQuery ? '找不到符合的區域' : '輸入編號搜尋'}
                </div>
              ) : (
                filteredAreas.slice(0, 50).map(area => (
                  <button
                    key={area.id}
                    onClick={() => handleSearchSelect(area.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      area.id === selectedAreaId
                        ? 'bg-mc-highlight/20 text-blue-400 border border-blue-500/30'
                        : 'text-mc-text/60 hover:text-mc-text hover:bg-mc-accent border border-transparent'
                    }`}
                  >
                    <span className="font-mono">#{area.id}</span>
                    <span className="text-xs text-mc-text/40">
                      {Math.round(area.center[0])}, {Math.round(area.center[1])}
                    </span>
                  </button>
                ))
              )}
            </div>
            {filteredAreas.length > 50 && (
              <div className="text-xs text-mc-text/30 text-center pt-2">
                前 50 筆，共 {filteredAreas.length} 筆
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
