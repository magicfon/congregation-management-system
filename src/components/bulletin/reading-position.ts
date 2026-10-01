export type ReadingPosition = { version: string; page: number; offset: number; zoom: number; left: number }

export function readPosition(value: string | null, version: string, pages: number): ReadingPosition | null {
  if (!value) return null
  try {
    const position = JSON.parse(value)
    if (!position || position.version !== version || !Number.isInteger(position.page) || position.page < 1 || position.page > pages) return null
    if (![position.offset, position.zoom, position.left].every((value: unknown) => typeof value === 'number' && Number.isFinite(value))) return null
    return { version, page: position.page, offset: Math.min(1, Math.max(0, position.offset)), zoom: Math.min(5, Math.max(1, position.zoom)), left: Math.min(1, Math.max(0, position.left)) }
  } catch { return null }
}
