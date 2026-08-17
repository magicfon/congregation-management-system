'use client'

import { useState, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type * as LeafletNS from 'leaflet'

interface MapSpec {
  id: string
  name: string
  range: string
  image: string
  thumb: string
  sizeLabel: string
  dims: [number, number] // [width, height]
}

const MAPS: MapSpec[] = [
  {
    id: 'nanzih',
    name: '楠梓區',
    range: 'A-1 ~ A-89',
    image: '/maps/nanzih-1-89.png',
    thumb: '/maps/thumbs/nanzih-1-89.webp',
    sizeLabel: '7884×5512 · 20MB',
    dims: [7884, 5512],
  },
  {
    id: 'chiaotou',
    name: '橋頭區',
    range: 'B-90 ~ B-148',
    image: '/maps/chiaotou-90-148.png',
    thumb: '/maps/thumbs/chiaotou-90-148.webp',
    sizeLabel: '4827×4534 · 6.6MB',
    dims: [4827, 4534],
  },
  {
    id: 'tzuguan',
    name: '梓官區',
    range: 'C-149 ~ C-213',
    image: '/maps/tzuguan-149-213.png',
    thumb: '/maps/thumbs/tzuguan-149-213.webp',
    sizeLabel: '4828×4038 · 4.7MB',
    dims: [4828, 4038],
  },
]

/** Deep-zoom 全螢幕檢視器：載入原圖，可縮放平移到任意區域細節 */
function DeepZoomViewer({ spec, onClose }: { spec: MapSpec; onClose: () => void }) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    let cancelled = false
    void (async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !divRef.current || mapRef.current) return
      const [w, h] = spec.dims
      const map = L.map(divRef.current, {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 3,
        zoomSnap: 0.25,
        attributionControl: false,
      })
      const bounds: LeafletNS.LatLngBoundsExpression = [
        [0, 0],
        [h, w],
      ]
      L.imageOverlay(spec.image, bounds).addTo(map)
      map.fitBounds(bounds)
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [spec])

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-mc-bg border-b border-white/10">
        <div>
          <span className="font-semibold text-mc-text">{spec.name}地圖</span>
          <span className="text-xs text-mc-text-secondary ml-2">
            {spec.range} · {spec.sizeLabel} · 滾輪/雙指縮放，拖曳平移
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={spec.image}
            download
            className="px-3 py-1.5 text-sm rounded-lg bg-mc-accent text-white hover:bg-mc-highlight transition-colors"
          >
            下載原圖
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-mc-text hover:bg-white/20 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
      <div ref={divRef} className="flex-1 bg-black" />
    </div>
  )
}

export default function MapImagesPage() {
  const [viewer, setViewer] = useState<MapSpec | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">地圖圖檔</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            查看與下載各區地圖原始圖檔（可縮放看到單一區域細節）
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {MAPS.map((m) => (
          <div key={m.id} className="mc-card rounded-xl overflow-hidden flex flex-col">
            <button
              type="button"
              className="block w-full text-left group"
              onClick={() => setViewer(m)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.thumb}
                alt={`${m.name}地圖`}
                className="w-full h-48 object-cover group-hover:opacity-80 transition-opacity"
              />
            </button>
            <div className="p-4 flex-1 flex flex-col gap-3">
              <div>
                <div className="font-semibold text-mc-text">{m.name}</div>
                <div className="text-xs text-mc-text-secondary mt-0.5">
                  {m.range} · {m.sizeLabel}
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setViewer(m)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-mc-accent/20 text-mc-highlight border border-mc-accent/40 hover:bg-mc-accent/30 transition-colors"
                >
                  縮放檢視
                </button>
                <a
                  href={m.image}
                  download
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-mc-accent text-white hover:bg-mc-highlight transition-colors text-center"
                >
                  下載
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mc-card rounded-xl p-4 text-sm text-mc-text-secondary">
        💡 <span className="text-mc-text">找不到自己的區域？</span>
        點「縮放檢視」後用滾輪放大，每個區域的編號會愈放愈清楚。未來會再加上各區單獨小圖。
      </div>

      {viewer && <DeepZoomViewer spec={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
