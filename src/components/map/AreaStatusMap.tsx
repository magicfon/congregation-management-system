'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { HEAT_STATUS_LABELS, type AreaStatusData } from '../../lib/area-status'

export default function AreaStatusMap({ data, selectedId, onSelect }: { data: AreaStatusData; selectedId: string | null; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const layers = useRef(new Map<string, Leaflet.Polygon>())
  const selection = useRef(onSelect)
  selection.current = onSelect
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setImageState('loading'); setError('')
    async function create() {
      const L = await import('leaflet')
      if (cancelled || !container.current) return
      const [width, height] = data.imageSize
      const bounds = L.latLngBounds([0, 0], [height, width])
      const map = L.map(container.current, { crs: L.CRS.Simple, minZoom: -6, maxZoom: 3, zoomSnap: .25, attributionControl: false })
      mapRef.current = map
      map.fitBounds(bounds, { padding: [8, 8] })
      L.imageOverlay('/maps/' + data.sourceImage, bounds).on('load', () => { if (!cancelled) setImageState('ready') }).on('error', () => { if (!cancelled) setImageState('error') }).addTo(map)
      // Render small overlapping blocks last so that they remain selectable.
      for (const region of [...data.regions].sort((a, b) => b.pixelArea - a.pixelArea)) {
        const coordinates = region.polygons.map(poly => poly.map(ring => ring.map(([x, y]) => [height - y, x] as [number, number])))
        const polygon = L.polygon(coordinates, { color: '#334155', weight: 1, fillColor: region.color, fillOpacity: .58, fillRule: 'evenodd' }).addTo(map)
        const label = `${region.numbers.length ? region.numbers.join('、') + ' 號' : '未配對區塊'}：${region.days === null ? HEAT_STATUS_LABELS[region.status] : region.days + ' 天未完成回報'}`
        const tooltip = document.createElement('span'); tooltip.textContent = label
        polygon.bindTooltip(tooltip, { sticky: true }).on('click', () => selection.current(region.candidateId))
        const element = polygon.getElement()
        if (element) {
          element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', label)
          element.addEventListener('keydown', e => { const key = (e as KeyboardEvent).key; if (key === 'Enter' || key === ' ') { e.preventDefault(); selection.current(region.candidateId) } })
        }
        layers.current.set(region.candidateId, polygon)
      }
    }
    void create().catch(() => { if (!cancelled) setError('地圖工具載入失敗，請重新整理。') })
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize())
    if (container.current) observer.observe(container.current)
    return () => { cancelled = true; observer.disconnect(); mapRef.current?.remove(); mapRef.current = null; layers.current.clear() }
  }, [data])
  useEffect(() => {
    for (const [id, layer] of layers.current) layer.setStyle({ color: id === selectedId ? '#ffffff' : '#334155', weight: id === selectedId ? 3 : 1, fillOpacity: id === selectedId ? .78 : .58 })
  }, [selectedId])
  return <div className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-mc-accent">
    <div ref={container} style={{ background: '#162132' }} className="h-[calc(100dvh-20rem)] min-h-[360px] max-h-[850px] w-full" aria-label="距上次完成回報熱力圖，可縮放及拖曳" />
    <button type="button" className="absolute top-3 right-3 z-[500] rounded-lg bg-mc-card px-3 py-2 text-sm shadow border border-white/10" onClick={() => { const [w, h] = data.imageSize; mapRef.current?.fitBounds([[0, 0], [h, w]], { padding: [8, 8] }) }}>全圖</button>
    {(imageState !== 'ready' || error) && <p role="status" className="absolute bottom-3 left-3 right-3 z-[500] rounded bg-mc-card/95 px-3 py-2 text-sm">{error || (imageState === 'error' ? '底圖載入失敗，仍可查看分區；請按重新整理再試。' : '正在載入大地圖…')}</p>}
  </div>
}
