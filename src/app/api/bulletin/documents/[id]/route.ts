import { notFound } from 'next/navigation'
import { bulletinDocuments, exportBulletinPdf } from '@/lib/bulletin-pdf'

export const dynamic = 'force-static'
export const revalidate = 300
export const dynamicParams = false
export function generateStaticParams() { return bulletinDocuments.map(document => ({ id: document.id })) }

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!bulletinDocuments.some(document => document.id === params.id)) notFound()
  // Throw on upstream failure: ISR must retain its last successful document.
  const bytes = await exportBulletinPdf(params.id)
  return new Response(bytes as BodyInit, { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="bulletin.pdf"',
    'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff',
  } })
}
