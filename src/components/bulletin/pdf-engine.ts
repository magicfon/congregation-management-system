'use client'

let engine: Promise<typeof import('pdfjs-dist')> | undefined
let worker: import('pdfjs-dist').PDFWorker | undefined
export function loadPdfEngine() {
  if (!engine) engine = import('pdfjs-dist/legacy/build/pdf.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/${pdfjs.version}/pdf.worker.min.mjs`
    worker = new pdfjs.PDFWorker()
    return pdfjs
  }).catch(error => { engine = undefined; throw error })
  return engine
}

export function getPdfWorker() { return worker }

export function prefetchPdf(id: string) {
  void fetch(`/api/bulletin/documents/${id}`, { cache: 'force-cache' }).catch(() => {})
}
