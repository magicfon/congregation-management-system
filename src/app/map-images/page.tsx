'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import 'leaflet/dist/leaflet.css'
import type * as LeafletNS from 'leaflet'

// ===== 資料 =====

interface AreaEntry {
  sheetNo: number
  code: string
  district: string
  full: string
  preview: string
  list: string
  dims: [number, number]
  size: number
}

interface BigMapSpec {
  id: string
  name: string
  range: string
  image: string
  thumb: string
  sizeLabel: string
  dims: [number, number]
}

const BIG_MAPS: BigMapSpec[] = [
  {
    id: 'nanzih',
    name: '楠梓全圖',
    range: 'A-1 ~ A-89',
    image: '/maps/nanzih-1-89.png',
    thumb: '/maps/thumbs/nanzih-1-89.webp',
    sizeLabel: '7884×5512 · 21MB',
    dims: [7884, 5512],
  },
  {
    id: 'chiaotou',
    name: '橋頭全圖',
    range: 'B-90 ~ B-148',
    image: '/maps/chiaotou-90-148.png',
    thumb: '/maps/thumbs/chiaotou-90-148.webp',
    sizeLabel: '4827×4534 · 6.6MB',
    dims: [4827, 4534],
  },
  {
    id: 'tzuguan',
    name: '梓官全圖',
    range: 'C-149 ~ C-213',
    image: '/maps/tzuguan-149-213.png',
    thumb: '/maps/thumbs/tzuguan-149-213.webp',
    sizeLabel: '4828×4038 · 4.7MB',
    dims: [4828, 4038],
  },
]

const DISTRICTS = ['全部', '楠梓', '橋頭', '梓官'] as const

let INDEX: Record<string, AreaEntry> | null = null

// ===== 全圖縮放檢視器 =====

function DeepZoomViewer({ spec, onClose }: { spec: BigMapSpec; onClose: () => void }) {
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
          <span className="font-semibold text-mc-text">{spec.name}</span>
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

// ===== 單區檢視 =====

function AreaViewer({ entry, onClose }: { entry: AreaEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-mc-bg border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <span className="font-semibold text-mc-text">{entry.code}</span>
          <span className="text-xs text-mc-text-secondary ml-2">
            {entry.district} · {entry.dims[0]}×{entry.dims[1]} · {(entry.size / 1e6).toFixed(1)}MB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={entry.full}
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
      <div className="flex-1 overflow-auto bg-black/60 p-4" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.preview}
          alt={`${entry.code} 地圖`}
          className="mx-auto max-w-full h-auto cursor-zoom-out"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        />
      </div>
    </div>
  )
}

// ===== 主頁面 =====

export default function MapImagesPage() {
  const [view, setView] = useState<'areas' | 'big'>('areas')
  const [entries, setEntries] = useState<AreaEntry[]>([])
  const [district, setDistrict] = useState<string>('全部')
  const [q, setQ] = useState('')
  const [viewer, setViewer] = useState<AreaEntry | null>(null)
  const [bigViewer, setBigViewer] = useState<BigMapSpec | null>(null)

  useEffect(() => {
    const load = () => {
      if (INDEX) setEntries(Object.values(INDEX).sort((a, b) => a.sheetNo - b.sheetNo))
    }
    load()
    window.addEventListener('maps-index-ready', load)
    return () => window.removeEventListener('maps-index-ready', load)
  }, [])

  const filtered = useMemo(() => {
    let out = entries
    if (district !== '全部') out = out.filter((e) => e.district === district)
    if (q.trim()) {
      const t = q.trim()
      out = out.filter((e) => e.code.includes(t) || String(e.sheetNo) === t)
    }
    return out
  }, [entries, district, q])

  return (
    <DashboardLayout>
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">地圖圖檔</h1>
          <p className="text-sm text-mc-text-secondary mt-1">查看與下載地圖（全圖縮放 / 各區域小圖）</p>
        </div>
      </div>

      {/* 檢視切換 */}
      <div className="flex rounded-lg overflow-hidden border border-mc-accent/30 w-fit">
        <button
          type="button"
          onClick={() => setView('areas')}
          className={`px-4 py-1.5 text-sm transition-colors ${
            view === 'areas' ? 'bg-mc-accent text-white' : 'bg-mc-card text-mc-text-secondary hover:text-mc-text'
          }`}
        >
          單區圖檔（212）
        </button>
        <button
          type="button"
          onClick={() => setView('big')}
          className={`px-4 py-1.5 text-sm transition-colors ${
            view === 'big' ? 'bg-mc-accent text-white' : 'bg-mc-card text-mc-text-secondary hover:text-mc-text'
          }`}
        >
          全區地圖（3）
        </button>
      </div>

      {/* ===== 全區地圖 ===== */}
      {view === 'big' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BIG_MAPS.map((m) => (
            <div key={m.id} className="mc-card rounded-xl overflow-hidden flex flex-col">
              <button type="button" className="block w-full group" onClick={() => setBigViewer(m)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumb}
                  alt={m.name}
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
                    onClick={() => setBigViewer(m)}
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
      )}

      {/* ===== 單區圖檔 ===== */}
      {view === 'areas' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-mc-accent/30">
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistrict(d)}
                  className={`px-4 py-1.5 text-sm transition-colors ${
                    district === d ? 'bg-mc-accent text-white' : 'bg-mc-card text-mc-text-secondary hover:text-mc-text'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋區域編號（如 A-80 或 80）"
              className="px-3 py-1.5 text-sm rounded-lg bg-mc-card border border-white/10 text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent w-64"
            />
            <div className="text-sm text-mc-text-secondary ml-auto">{filtered.length} 區</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {filtered.map((e) => (
              <div key={e.sheetNo} className="mc-card rounded-xl overflow-hidden group">
                <button type="button" className="block w-full" onClick={() => setViewer(e)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.list}
                    alt={`${e.code} 地圖`}
                    loading="lazy"
                    className="w-full h-32 object-cover group-hover:opacity-80 transition-opacity"
                  />
                </button>
                <div className="p-2.5 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-mc-text truncate">{e.code}</div>
                    <div className="text-[11px] text-mc-text-secondary">{e.district}</div>
                  </div>
                  <a
                    href={e.full}
                    download
                    title="下載原圖"
                    className="shrink-0 p-1.5 rounded-lg bg-mc-accent/20 text-mc-highlight border border-mc-accent/40 hover:bg-mc-accent/30 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {entries.length === 0 && (
            <div className="mc-card rounded-xl p-8 text-center text-mc-text-secondary">圖檔載入中…</div>
          )}
        </>
      )}

      {viewer && <AreaViewer entry={viewer} onClose={() => setViewer(null)} />}
      {bigViewer && <DeepZoomViewer spec={bigViewer} onClose={() => setBigViewer(null)} />}
    </div>
    </DashboardLayout>
  )
}

// client-only index fetch
if (typeof window !== 'undefined' && !INDEX) {
  void fetch('/maps/areas/index.json')
    .then((r) => r.json())
    .then((d) => {
      INDEX = d
      window.dispatchEvent(new Event('maps-index-ready'))
    })
    .catch(() => {})
}
