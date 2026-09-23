import { NextRequest } from 'next/server'
import { readBoundaryDraft, writeBoundaryDraft } from '../../../../../lib/boundary-draft-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: { mapId: string } }

export async function GET(request: NextRequest, context: Context) {
  return readBoundaryDraft(request, context)
}

export async function PUT(request: NextRequest, context: Context) {
  return writeBoundaryDraft(request, context, 'public-editor')
}
