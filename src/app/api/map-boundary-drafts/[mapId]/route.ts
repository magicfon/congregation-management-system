import { NextRequest } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { readBoundaryDraft, writeBoundaryDraft } from '../../../../lib/boundary-draft-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: { mapId: string } }

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  return readBoundaryDraft(request, context)
}

export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  return writeBoundaryDraft(request, context, auth.user.id!)
}
