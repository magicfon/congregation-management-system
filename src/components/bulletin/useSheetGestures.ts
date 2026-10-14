'use client'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** Touch uses native browser pinch zoom; mouse zoom stays local to the paper. */
export function useSheetGestures(viewport: RefObject<HTMLDivElement>, sheet: RefObject<HTMLElement>, enabled: boolean, scale: number, fit: number, setZoom: (zoom: number | null) => void) {
  const current = useRef(scale)
  const anchor = useRef<{ x: number; y: number; paperX: number; paperY: number } | null>(null)
  useLayoutEffect(() => {
    current.current = scale
    const point = anchor.current, paper = sheet.current, view = viewport.current
    if (!point || !paper || !view) return
    anchor.current = null
    const rect = paper.getBoundingClientRect()
    view.scrollLeft += rect.left + point.paperX * scale - point.x
    window.scrollBy(0, rect.top + point.paperY * scale - point.y)
  }, [scale, sheet, viewport])
  useEffect(() => {
    const view = viewport.current
    if (!enabled || !view) return
    let drag: { id: number; x: number; y: number } | null = null
    const wheel = (event: WheelEvent) => {
      // Leave browser Ctrl+wheel / trackpad pinch and all touch gestures native.
      if (event.ctrlKey || !window.matchMedia('(pointer: fine)').matches || !sheet.current) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1)
      const next = Math.max(fit, Math.min(3, current.current * Math.exp(-Math.max(-120, Math.min(120, delta)) * .002)))
      if (next === current.current) return
      event.preventDefault()
      const rect = sheet.current.getBoundingClientRect()
      const renderedScale = rect.width / sheet.current.offsetWidth
      anchor.current = { x: event.clientX, y: event.clientY, paperX: (event.clientX - rect.left) / renderedScale, paperY: (event.clientY - rect.top) / renderedScale }
      current.current = next
      setZoom(next)
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      view.setPointerCapture(event.pointerId)
      view.style.cursor = 'grabbing'
      event.preventDefault()
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      view.scrollLeft += drag.x - event.clientX
      window.scrollBy(0, drag.y - event.clientY)
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const up = () => { drag = null; view.style.cursor = '' }
    const key = (event: KeyboardEvent) => {
      if (!['+', '=', '-', '0'].includes(event.key) || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      setZoom(event.key === '0' ? null : Math.max(fit, Math.min(3, current.current * (event.key === '-' ? 1 / 1.15 : 1.15))))
    }
    view.addEventListener('wheel', wheel, { passive: false })
    view.addEventListener('pointerdown', down)
    view.addEventListener('pointermove', move)
    view.addEventListener('pointerup', up)
    view.addEventListener('lostpointercapture', up)
    view.addEventListener('keydown', key)
    return () => {
      view.removeEventListener('wheel', wheel)
      view.removeEventListener('pointerdown', down)
      view.removeEventListener('pointermove', move)
      view.removeEventListener('pointerup', up)
      view.removeEventListener('lostpointercapture', up)
      view.removeEventListener('keydown', key)
      view.style.cursor = ''
    }
  }, [enabled, fit, setZoom, sheet, viewport])
}
