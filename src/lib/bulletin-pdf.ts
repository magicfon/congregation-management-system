import { bulletinCategories } from './bulletin'
import { createHash } from 'node:crypto'
import { getAccessToken } from './google-sheets'

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

async function getModifiedTime(id: string): Promise<string | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const lookup = async () => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=modifiedTime`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
      })
      if (!response.ok) return null
      const data = await response.json()
      return typeof data.modifiedTime === 'string' && Number.isFinite(Date.parse(data.modifiedTime)) ? new Date(data.modifiedTime).toISOString() : null
    } catch { return null }
  }
  try {
    return await Promise.race([lookup(), new Promise<null>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(null) }, 3000)
    })])
  } finally { clearTimeout(timer) }
}

export function bulletinPdfVersion(bytes: Uint8Array): string {
  // Google regenerates export dates and trailer IDs even when the content is unchanged.
  const content = Buffer.from(bytes).toString('latin1')
    .replace(/\/(?:CreationDate|ModDate)\s*\(D:[^)]*\)/g, '')
    .replace(/\/ID\s*\[\s*<[\da-f]+>\s*<[\da-f]+>\s*\]/gi, '')
  return createHash('sha256').update(content, 'latin1').digest('hex')
}

export async function exportBulletinSnapshot(id: string) {
  if (!bulletinDocuments.some(document => document.id === id)) throw new Error('Unknown bulletin document')
  const [bytes, modifiedAt] = await Promise.all([exportBulletinPdf(id), getModifiedTime(id)])
  return { bytes, modifiedAt, syncedAt: new Date().toISOString(), version: modifiedAt ?? bulletinPdfVersion(bytes) }
}
