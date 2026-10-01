import assert from 'node:assert/strict'
import { bulletinDocuments, bulletinPdfVersion, exportBulletinPdf } from '../src/lib/bulletin-pdf'
import { readPosition } from '../src/components/bulletin/reading-position'

async function main() {
const realFetch = globalThis.fetch
let requests = 0
globalThis.fetch = async () => { requests++; return new Response('%PDF-1.7\nfixture', { headers: { 'Content-Type': 'application/pdf' } }) }
try {
  await assert.rejects(exportBulletinPdf('https://example.com/private'), /Unknown/)
  assert.equal(requests, 0, 'Unlisted sources must never trigger a fetch')
  const id = bulletinDocuments[0].id
  assert.equal(new TextDecoder().decode(await exportBulletinPdf(id)), '%PDF-1.7\nfixture')
  globalThis.fetch = async () => new Response('<html>Login required</html>', { headers: { 'Content-Type': 'text/html' } })
  await assert.rejects(exportBulletinPdf(id), /unavailable/)
  const bytes = (text: string) => new TextEncoder().encode(text)
  assert.equal(bulletinPdfVersion(bytes('%PDF /CreationDate (D:20261001010000) /ID [<abc> <def>] content')), bulletinPdfVersion(bytes('%PDF /CreationDate (D:20261002010000) /ID [<123> <456>] content')), 'An export date change must not discard reading progress')
  assert.notEqual(bulletinPdfVersion(bytes('%PDF first')), bulletinPdfVersion(bytes('%PDF updated')), 'New content must have a new version')
  const position = { version: 'v1', page: 2, offset: 0.4, zoom: 2, left: 0.2 }
  assert.deepEqual(readPosition(JSON.stringify(position), 'v1', 8), position)
  assert.equal(readPosition(JSON.stringify(position), 'v2', 8), null, 'New versions start at the beginning')
  assert.equal(readPosition(JSON.stringify(position), 'v1', 1), null, 'Removed pages must not be restored')
  assert.equal(readPosition('{bad json', 'v1', 8), null)
  assert.equal(readPosition(JSON.stringify({ ...position, offset: '0.4' }), 'v1', 8), null)
  assert.deepEqual(readPosition(JSON.stringify({ ...position, offset: -1, zoom: 99, left: 99 }), 'v1', 8), { ...position, offset: 0, zoom: 5, left: 1 })
  globalThis.fetch = async () => new Response('not a PDF', { headers: { 'Content-Type': 'application/pdf' } })
  await assert.rejects(exportBulletinPdf(id), /Invalid/)
  globalThis.fetch = async () => new Response('Temporary failure', { status: 503 })
  await assert.rejects(exportBulletinPdf(id), /unavailable/)
  console.log('Bulletin PDF source and failure checks passed')
} finally { globalThis.fetch = realFetch }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
