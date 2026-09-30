import { bulletinCategories } from './bulletin'

export const bulletinDocuments = bulletinCategories.flatMap(category => category.sources.flatMap(source => {
  if (!source.pdf) return []
  const url = new URL(source.url)
  const exportUrl = source.url.includes('/document/')
    ? `https://docs.google.com/document/d/${source.pdf}/export?format=pdf`
    : `https://docs.google.com/spreadsheets/d/${source.pdf}/export?format=pdf&gid=${url.searchParams.get('gid') ?? '0'}&size=A3&portrait=false&fitw=true&gridlines=false&sheetnames=false&printtitle=false`
  return [{ id: source.pdf, exportUrl }]
}))

export async function exportBulletinPdf(id: string): Promise<Uint8Array> {
  const source = bulletinDocuments.find(document => document.id === id)
  if (!source) throw new Error('Unknown bulletin document')
  const response = await fetch(source.exportUrl, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Google PDF unavailable')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > 10_000_000 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid bulletin PDF')
  return bytes
}
