import { NextRequest, NextResponse } from 'next/server'
import { readBoundaryDraft, writeBoundaryDraft } from '../../../../../lib/boundary-draft-api'
import { PUBLIC_BOUNDARY_EDITOR_ENABLED } from '../../../../../lib/public-boundary-editor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: { mapId: string } }

export async function GET(request: NextRequest, context: Context) {
  return readBoundaryDraft(request, context)
}

export async function PUT(request: NextRequest, context: Context) {
  if (!PUBLIC_BOUNDARY_EDITOR_ENABLED) return NextResponse.json({ error: '地圖編輯暫停開放' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  return writeBoundaryDraft(request, context, 'public-editor')
}
