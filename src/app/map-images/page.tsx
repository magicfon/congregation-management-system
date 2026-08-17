'use client'

import { useState, useEffect, useMemo } from 'react'

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

const DISTRICTS = ['全部', '楠梓', '橋頭', '梓官'] as const

/** 原圖載入中的 213 張單區圖資訊，build 時產生的 index */
let INDEX: Record<string, AreaEntry> | null = null

export default function MapImagesPage() {
  const [entries, setEntries] = useState<AreaEntry[]>([])
  const [district, setDistrict] = useState<string>('全部')
  const [q, setQ] = useState('')
  const [viewer, setViewer] = useState<AreaEntry | null>(null)

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">地圖圖檔</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            查看與下載各區域地圖（{entries.length} 區）
          </p>
        </div>
      </div>

      {/* 篩選器 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-mc-accent/30">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDistrict(d)}
              className={`px-4 py-1.5 text-sm transition-colors ${
                district === d
                  ? 'bg-mc-accent text-white'
                  : 'bg-mc-card text-mc-text-secondary hover:text-mc-text'
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
        <div className="text-sm text-mc-text-secondary ml-auto">
          {filtered.length} 區
        </div>
      </div>

      {/* 區域格線 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {filtered.map((e) => (
          <div key={e.sheetNo} className="mc-card rounded-xl overflow-hidden group">
            <button
              type="button"
              className="block w-full"
              onClick={() => setViewer(e)}
            >
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="mc-card rounded-xl p-8 text-center text-mc-text-secondary">
          圖檔載入中…
        </div>
      )}

      {/* 單區檢視 */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setViewer(null)}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-mc-bg border-b border-white/10" onClick={(e) => e.stopPropagation()}>
            <div>
              <span className="font-semibold text-mc-text">{viewer.code}</span>
              <span className="text-xs text-mc-text-secondary ml-2">
                {viewer.district} · {viewer.dims[0]}×{viewer.dims[1]} · {(viewer.size / 1e6).toFixed(1)}MB
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={viewer.full}
                download
                className="px-3 py-1.5 text-sm rounded-lg bg-mc-accent text-white hover:bg-mc-highlight transition-colors"
              >
                下載原圖
              </a>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-mc-text hover:bg-white/20 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-black/60 p-4" onClick={() => setViewer(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewer.preview}
              alt={`${viewer.code} 地圖`}
              className="mx-auto max-w-full h-auto cursor-zoom-out"
              onClick={(e) => { e.stopPropagation(); setViewer(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// fetch index at module load (client only)
if (typeof window !== 'undefined' && !INDEX) {
  void fetch('/maps/areas/index.json')
    .then((r) => r.json())
    .then((d) => {
      INDEX = d
      window.dispatchEvent(new Event('maps-index-ready'))
    })
    .catch(() => {})
}
