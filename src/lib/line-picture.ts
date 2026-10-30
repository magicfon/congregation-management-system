// LINE profile pictures are served from LINE's CDN over HTTPS; anything else is ignored.
export function linePictureUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}
