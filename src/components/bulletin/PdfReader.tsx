'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfWorker, loadPdfEngine } from './pdf-engine'

export default function PdfReader({ id, label }: { id: string; label: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageRatio, setPageRatio] = useState(1.414)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [retry, setRetry] = useState(0)
  const pane = useRef<HTMLDivElement>(null)
  const started = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number; zoom: number; x: number; y: number; left: number; top: number } | null>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  useEffect(() => {
    let disposed = false
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined
    const controller = new AbortController()
    started.current = performance.now()
    setError(false)
    setReady(false)
    setDocument(null)
    setZoom(1)
    void Promise.all([
      loadPdfEngine(),
      fetch(`/api/bulletin/documents/${id}`, { signal: controller.signal }).then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('PDF unavailable')
        return new Uint8Array(await response.arrayBuffer())
      }),
    ]).then(async ([engine, bytes]) => {
      if (disposed) return
      task = engine.getDocument({ data: bytes, worker: getPdfWorker(), useSystemFonts: true })
      const pdf = await task.promise
      const firstPage = await pdf.getPage(1)
      const viewport = firstPage.getViewport({ scale: 1 })
      if (!disposed) { setPageRatio(viewport.height / viewport.width); setDocument(pdf) }
    }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true; controller.abort(); if (task) void task.destroy() }
  }, [id, retry])

  useEffect(() => {
    const element = pane.current
    if (!element) return
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const firstPaint = useCallback((element: HTMLCanvasElement) => {
    setReady(true)
    if (!element.dataset.firstPageMs) {
      element.dataset.firstPageMs = String(Math.round(performance.now() - started.current))
      element.dataset.firstPaintAtMs = String(Math.round(performance.now()))
    }
  }, [])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => { window.document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', escape) }
  }, [expanded])

  function endPointer(pointerId: number) { pointers.current.delete(pointerId); gesture.current = null; drag.current = null }
  const button = 'min-h-11 min-w-11 rounded-lg border border-white/10 px-3 text-sm hover:bg-mc-accent disabled:opacity-30'

  return <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-mc-bg p-2 sm:p-4' : ''} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? label : undefined}
    onKeyDown={event => {
      if (!expanded || event.key !== 'Tab') return
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-3">
      <span className="text-xs tabular-nums">共 {document?.numPages ?? '…'} 頁</span>
      <button type="button" className={button} disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))} aria-label="縮小">−</button>
      <button type="button" className={button} onClick={() => { setZoom(1); pane.current?.scrollTo(0, 0) }} aria-label="縮放重設">{Math.round(zoom * 100)}%</button>
      <button type="button" className={button} disabled={zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + 0.5))} aria-label="放大">＋</button>
      <button type="button" className={`${button} ml-auto`} onClick={() => setExpanded(value => !value)}>{expanded ? '關閉全螢幕' : '全螢幕'}</button>
    </div>
    <div ref={pane} className={`relative overflow-auto bg-mc-accent/40 ${expanded ? 'min-h-0 flex-1' : 'h-[65vh] min-h-[360px]'}`} style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      onPointerDown={event => {
        if (!ready || event.button !== 0) return
        const element = pane.current!
        element.setPointerCapture(event.pointerId)
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const values = Array.from(pointers.current.values())
        if (values.length === 2) {
          const rect = element.getBoundingClientRect()
          gesture.current = { distance: Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y), zoom, x: (values[0].x + values[1].x) / 2 - rect.left, y: (values[0].y + values[1].y) / 2 - rect.top, left: element.scrollLeft, top: element.scrollTop }
        } else drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId) || !pane.current) return
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const values = Array.from(pointers.current.values())
        const pinch = gesture.current
        if (values.length === 2 && pinch && pinch.distance > 0) {
          const next = Math.min(5, Math.max(1, pinch.zoom * Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y) / pinch.distance))
          setZoom(next)
          requestAnimationFrame(() => {
            if (!pane.current) return
            pane.current.scrollLeft = (pinch.left + pinch.x) * next / pinch.zoom - pinch.x
            pane.current.scrollTop = (pinch.top + pinch.y) * next / pinch.zoom - pinch.y
          })
        } else if (drag.current) {
          pane.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
          pane.current.scrollTop = drag.current.top - (event.clientY - drag.current.y)
        }
      }}
      onPointerUp={event => endPointer(event.pointerId)} onPointerCancel={event => endPointer(event.pointerId)} onLostPointerCapture={event => endPointer(event.pointerId)}>
      {!ready && !error && <p role="status" className="absolute left-4 top-4 rounded-lg bg-mc-card px-4 py-3 text-sm text-mc-text/60">正在載入文件…</p>}
      {error && <div role="alert" className="p-6 text-sm leading-7"><p>文件暫時無法顯示，可開啟原文件或重試。</p><button className={button} onClick={() => setRetry(value => value + 1)}>重試</button></div>}
      {document && width > 0 && !error && Array.from({ length: document.numPages }, (_, index) => <PdfPage key={`${id}-${retry}-${index}`} document={document} page={index + 1} label={label} width={Math.max(1, width - 24) * zoom} initialRatio={pageRatio} root={pane.current} onFirstPaint={firstPaint} />)}
    </div>
    <p className="px-4 py-2 text-xs text-mc-text/50">往下捲動閱讀 · 雙指縮放 · 文件定期更新</p>
  </div>
}

function PdfPage({ document, page, label, width, initialRatio, root, onFirstPaint }: {
  document: PDFDocumentProxy; page: number; label: string; width: number; initialRatio: number; root: HTMLDivElement | null; onFirstPaint: (canvas: HTMLCanvasElement) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const painted = useRef(false)
  const [visible, setVisible] = useState(page === 1)
  const [ratio, setRatio] = useState(initialRatio)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const element = container.current
    if (!element || !root) return
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { root, rootMargin: '300px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [root])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    if (!visible) { element.width = 0; element.height = 0; setReady(false); return }
    let disposed = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    setError(false)
    const timer = window.setTimeout(() => {
      void document.getPage(page).then(async pdfPage => {
        if (disposed) return
        const base = pdfPage.getViewport({ scale: 1 })
        setRatio(base.height / base.width)
        const viewport = pdfPage.getViewport({ scale: width / base.width })
        const context = element.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)))
        element.width = Math.ceil(viewport.width * pixelRatio)
        element.height = Math.ceil(viewport.height * pixelRatio)
        task = pdfPage.render({ canvas: element, canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] })
        await task.promise
        if (disposed) return
        painted.current = true
        setReady(true)
        if (page === 1) onFirstPaint(element)
      }).catch(err => { if (!disposed && err?.name !== 'RenderingCancelledException') setError(true) })
    }, painted.current ? 100 : 0)
    return () => { disposed = true; clearTimeout(timer); task?.cancel() }
  }, [document, page, width, visible, retry, onFirstPaint])

  return <div ref={container} data-pdf-page={page} className="relative m-3 bg-white" style={{ width, height: width * ratio }}>
    {!ready && <span className="absolute left-3 top-3 rounded bg-mc-card px-3 py-2 text-xs text-mc-text">{error ? <button onClick={() => setRetry(value => value + 1)}>第 {page} 頁載入失敗，點此重試</button> : `第 ${page} 頁`}</span>}
    <canvas ref={canvas} role="img" aria-label={`${label}，第 ${page} 頁`} className="block h-full w-full" style={{ visibility: ready ? 'visible' : 'hidden' }} />
  </div>
}
