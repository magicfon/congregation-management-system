import assert from 'node:assert/strict'
import { bulletinDocuments, exportBulletinPdf } from '../src/lib/bulletin-pdf'

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
  globalThis.fetch = async () => new Response('not a PDF', { headers: { 'Content-Type': 'application/pdf' } })
  await assert.rejects(exportBulletinPdf(id), /Invalid/)
  globalThis.fetch = async () => new Response('Temporary failure', { status: 503 })
  await assert.rejects(exportBulletinPdf(id), /unavailable/)
  console.log('Bulletin PDF source and failure checks passed')
} finally { globalThis.fetch = realFetch }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
