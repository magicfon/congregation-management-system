'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfWorker, loadPdfEngine } from './pdf-engine'
import { readPosition, type ReadingPosition } from './reading-position'
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react'

export default function PdfReader({ id, label, src, title, sourceUrl }: { id: string; label: string; src?: string; title?: string; sourceUrl?: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageRatio, setPageRatio] = useState(1.414)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [retry, setRetry] = useState(0)
  const [version, setVersion] = useState('')
  const [timestamp, setTimestamp] = useState<{ value: string; modified: boolean } | null>(null)
  const [resumedPage, setResumedPage] = useState<number | null>(null)
  const pendingPosition = useRef<ReadingPosition | null>(null)
  const positionReady = useRef(false)
  const latestZoom = useRef(zoom)
  latestZoom.current = zoom
  const pane = useRef<HTMLDivElement>(null)
  const frame = useRef<{ document: PDFDocumentProxy; box: Promise<Crop> } | null>(null)
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
    setTimestamp(null)
    setVersion('')
    setResumedPage(null)
    positionReady.current = false
    pendingPosition.current = null
    void Promise.all([
      loadPdfEngine(),
      fetch(src ?? `/api/bulletin/documents/${id}`, { signal: controller.signal }).then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('PDF unavailable')
        return { bytes: new Uint8Array(await response.arrayBuffer()), version: response.headers.get('X-Bulletin-Version') ?? '', modified: response.headers.get('X-Bulletin-Modified-At'), synced: response.headers.get('X-Bulletin-Synced-At') }
      }),
    ]).then(async ([engine, snapshot]) => {
      if (disposed) return
      task = engine.getDocument({ data: snapshot.bytes, worker: getPdfWorker(), useSystemFonts: true })
      const pdf = await task.promise
      const firstPage = await pdf.getPage(1)
      const viewport = firstPage.getViewport({ scale: 1 })
      if (!disposed) {
        if (snapshot.version) {
          try { pendingPosition.current = readPosition(localStorage.getItem(`bulletin-position:${id}`), snapshot.version, pdf.numPages) } catch { /* Reading works without storage. */ }
        }
        const time = snapshot.modified ?? snapshot.synced
        if (time && Number.isFinite(Date.parse(time))) setTimestamp({ value: time, modified: Boolean(snapshot.modified) })
        setVersion(snapshot.version)
        setZoom(pendingPosition.current?.zoom ?? 1)
        setPageRatio(viewport.height / viewport.width)
        setDocument(pdf)
      }
    }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true; controller.abort(); if (task) void task.destroy() }
  }, [id, src, retry])

  useEffect(() => {
    const element = pane.current
    if (!element) return
    const observer = new ResizeObserver(entries => { setWidth(entries[0].contentRect.width); setHeight(entries[0].contentRect.height) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = pane.current
    if (!document || !element || width <= 0 || positionReady.current) return
    const position = pendingPosition.current
    const page = position ? element.querySelector<HTMLElement>(`[data-pdf-page="${position.page}"]`) : null
    if (position && page) {
      element.scrollTop = page.offsetTop + page.offsetHeight * position.offset
      element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth) * position.left
      if (position.page > 1 || position.offset > 0) setResumedPage(position.page)
    } else element.scrollTo(0, 0)
    positionReady.current = true
    pendingPosition.current = null
  }, [document, width, zoom])

  useEffect(() => {
    const element = pane.current
    if (!document || !element || !version) return
    const initialized = positionReady.current
    let timer: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      if (!positionReady.current && !initialized) return
      const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'))
      const page = pages.find(page => page.offsetTop + page.offsetHeight > element.scrollTop) ?? pages[pages.length - 1]
      if (!page) return
      const position: ReadingPosition = {
        version, page: Number(page.dataset.pdfPage),
        offset: Math.min(1, Math.max(0, (element.scrollTop - page.offsetTop) / page.offsetHeight)),
        zoom: latestZoom.current,
        left: element.scrollLeft / Math.max(1, element.scrollWidth - element.clientWidth),
      }
      try { localStorage.setItem(`bulletin-position:${id}`, JSON.stringify(position)) } catch { /* Storage restrictions must not interrupt reading. */ }
    }
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(save, 250) }
    const onVisibility = () => { if (window.document.visibilityState === 'hidden') save() }
    element.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', save)
    window.document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer); save()
      element.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', save)
      window.document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [document, id, version])

  const firstFrame = useCallback(() => {
    if (!document) return Promise.resolve({ x: 0, y: 0, w: 1, h: 1 })
    if (frame.current?.document !== document) frame.current = { document, box: document.getPage(1).then(contentBox) }
    return frame.current.box
  }, [document])

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

  // 電腦以滑鼠滾輪縮放（以游標為中心），手機以雙指縮放；不提供縮放按鈕（ADR-0067）。
  useEffect(() => {
    const element = pane.current
    if (!element || !ready) return
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !window.matchMedia('(pointer: fine)').matches) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
      const previous = latestZoom.current
      const next = Math.min(5, Math.max(1, previous * Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.002)))
      event.preventDefault()
      if (next === previous) return
      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left, y = event.clientY - rect.top
      const left = element.scrollLeft, top = element.scrollTop
      latestZoom.current = next
      setZoom(next)
      requestAnimationFrame(() => {
        element.scrollLeft = (left + x) * next / previous - x
        element.scrollTop = (top + y) * next / previous - y
      })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [ready])

  function endPointer(pointerId: number) { pointers.current.delete(pointerId); gesture.current = null; drag.current = null }
  const button = 'min-h-11 min-w-11 rounded-lg border border-white/10 px-3 text-sm hover:bg-mc-accent disabled:opacity-30'
  const icon = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-blue-300 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400'

  return <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-mc-bg p-2 sm:p-4' : ''} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? label : undefined}
    onKeyDown={event => {
      if (!expanded || event.key !== 'Tab') return
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
    {/* 單列工具列：標題（多份文件時）、頁數與時間，右側為原文件與全螢幕圖示（ADR-0069）。 */}
    <div className="flex items-center gap-1 px-3 py-1.5">
      <p className="min-w-0 flex-1 truncate text-xs text-mc-text/60">
        {title && <span className="mr-2 text-sm font-semibold text-mc-text">{title}</span>}
        <span className="tabular-nums">{document?.numPages ?? '…'} 頁</span>
        {timestamp && <span title={timestamp.modified ? 'Google 文件最後修改時間' : '本站取得這份文件的時間，非 Google 最後修改時間'}> · {timestamp.modified ? '更新' : '同步'} <time dateTime={timestamp.value} className="tabular-nums">{new Date(timestamp.value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time></span>}
      </p>
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="開啟原文件（另開分頁）" title="開啟原文件" className={icon}><ExternalLink aria-hidden="true" className="h-5 w-5" /></a>}
      <button type="button" aria-label={expanded ? '關閉全螢幕' : '全螢幕'} title={expanded ? '關閉全螢幕' : '全螢幕'} className={icon} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 aria-hidden="true" className="h-5 w-5" /> : <Maximize2 aria-hidden="true" className="h-5 w-5" />}</button>
    </div>
    <div ref={pane} className={`relative overflow-auto bg-mc-accent/40 ${expanded ? 'min-h-0 flex-1' : 'h-[calc(100dvh-11rem)] min-h-[360px]'}`} style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
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
      {document && width > 0 && !error && Array.from({ length: document.numPages }, (_, index) => <PdfPage key={`${id}-${retry}-${index}`} frame={firstFrame} document={document} page={index + 1} label={label} width={Math.max(1, width - 24)} height={Math.max(1, height - 24)} zoom={zoom} initialRatio={pageRatio} root={pane.current} onFirstPaint={firstPaint} />)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-mc-text/50">
      <p>手機雙指縮放 · 電腦滾輪縮放、拖曳移動 · 自動記住閱讀位置</p>
      {resumedPage && <p role="status" className="flex items-center gap-2">已接續第 {resumedPage} 頁<button type="button" className="min-h-11 rounded-lg px-2 text-blue-300 hover:bg-mc-accent" onClick={() => { setZoom(1); pane.current?.scrollTo(0, 0); setResumedPage(null) }}>回到開頭</button></p>}
    </div>
  </div>
}

function PdfPage({ frame, document, page, label, width: paneWidth, height: paneHeight, zoom, initialRatio, root, onFirstPaint }: {
  frame: () => Promise<Crop>; document: PDFDocumentProxy; page: number; label: string; width: number; height: number; zoom: number; initialRatio: number; root: HTMLDivElement | null; onFirstPaint: (canvas: HTMLCanvasElement) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const painted = useRef(false)
  const [visible, setVisible] = useState(page === 1)
  const [ratio, setRatio] = useState(initialRatio)
  // 整頁放進閱讀區：寬度與高度取較小的比例，再乘上使用者縮放（ADR-0068）。
  const width = Math.min(paneWidth, paneHeight / ratio) * zoom
  const crop = useRef<Promise<Crop> | null>(null)
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
        const box = await (crop.current ??= Promise.all([contentBox(pdfPage), frame()]).then(([own, first]) => {
          // 左右邊界與第一頁取聯集，各頁字級一致；上下邊界各頁自行裁切。
          const left = Math.min(own.x, first.x), right = Math.max(own.x + own.w, first.x + first.w)
          return { ...own, x: left, w: right - left }
        }))
        if (disposed) return
        setRatio(base.height * box.h / (base.width * box.w))
        const scale = width / (base.width * box.w)
        const viewport = pdfPage.getViewport({ scale, offsetX: -box.x * base.width * scale, offsetY: -box.y * base.height * scale })
        const context = element.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        const cropped = { width: base.width * box.w * scale, height: base.height * box.h * scale }
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (cropped.width * cropped.height)))
        element.width = Math.ceil(cropped.width * pixelRatio)
        element.height = Math.ceil(cropped.height * pixelRatio)
        task = pdfPage.render({ canvas: element, canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] })
        await task.promise
        if (disposed) return
        painted.current = true
        setReady(true)
        onFirstPaint(element)
      }).catch(err => { if (!disposed && err?.name !== 'RenderingCancelledException') setError(true) })
    }, painted.current ? 100 : 0)
    return () => { disposed = true; clearTimeout(timer); task?.cancel() }
  }, [document, frame, page, width, visible, retry, onFirstPaint])

  return <div ref={container} data-pdf-page={page} className="relative mx-auto my-3 bg-white" style={{ width, height: width * ratio }}>
    {!ready && <span className="absolute left-3 top-3 rounded bg-mc-card px-3 py-2 text-xs text-mc-text">{error ? <button onClick={() => setRetry(value => value + 1)}>第 {page} 頁載入失敗，點此重試</button> : `第 ${page} 頁`}</span>}
    <canvas ref={canvas} role="img" aria-label={`${label}，第 ${page} 頁`} className="block h-full w-full" style={{ visibility: ready ? 'visible' : 'hidden' }} />
  </div>
}

type Crop = { x: number; y: number; w: number; h: number }
type PdfPageProxy = Awaited<ReturnType<PDFDocumentProxy['getPage']>>

// 裁掉頁面四周的空白邊界，讓內容自適應閱讀區寬度（ADR-0068）。以低解析度繪製一次，找出非白色像素範圍。
async function contentBox(pdfPage: PdfPageProxy): Promise<Crop> {
  const full = { x: 0, y: 0, w: 1, h: 1 }
  try {
    const base = pdfPage.getViewport({ scale: 1 })
    const viewport = pdfPage.getViewport({ scale: 400 / base.width })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return full
    await pdfPage.render({ canvas, canvasContext: context, viewport }).promise
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
    let left = width, right = -1, top = height, bottom = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 0 && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
    if (right < 0) return full
    const pad = width * 0.01
    const x = Math.max(0, left - pad), y = Math.max(0, top - pad)
    const box = { x: x / width, y: y / height, w: (Math.min(width, right + 1 + pad) - x) / width, h: (Math.min(height, bottom + 1 + pad) - y) / height }
    // 內容太小（如空白頁的頁碼）時不裁切，避免過度放大。
    return box.w * box.h < 0.002 ? full : box
  } catch {
    return full
  }
}
