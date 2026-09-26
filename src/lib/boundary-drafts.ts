import geometry from '../../public/tools/boundary-editor/geometry'
import nanzih from '../../public/maps/reconstruction-v1/nanzih.json'
import chiaotou from '../../public/maps/reconstruction-v1/chiaotou.json'
import tzuguan from '../../public/maps/reconstruction-v1/tzuguan.json'

const originals = { nanzih, chiaotou, tzuguan }
export function boundaryOriginal(mapId: keyof typeof originals) { return originals[mapId] }

export function boundaryMapId(value: string): value is keyof typeof originals {
  return Object.prototype.hasOwnProperty.call(originals, value)
}

export function validateBoundarySave(mapId: keyof typeof originals, payload: unknown) {
  if (!payload || typeof payload !== 'object') throw new Error('缺少修正資料')
  const input = payload as { expectedVersion?: unknown; document?: unknown }
  if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 0 || (input.expectedVersion as number) > 2147483645) {
    throw new Error('草稿版本無效')
  }
  const base = originals[mapId]
  const doc = geometry.independentBlocks(geometry.validate(input.document, base))
  geometry.validate(doc, base)
  // Reconstruct metadata from the trusted source. Client summaries/approval flags are not authoritative.
  const document = geometry.refresh({ ...base, boundaryModel: 'independent-blocks-v1', candidates: doc.candidates.map((c: { candidateId: string; polygons: number[][][][] }) => ({
    candidateId: c.candidateId, polygons: c.polygons, status: 'needs-review', numberCandidates: [], issues: [], pixelArea: 0,
  })) })
  return { expectedVersion: input.expectedVersion as number, document }
}
