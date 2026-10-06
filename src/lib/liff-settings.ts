export function configuredLiffId(): string | null {
  const id = process.env.LINE_LIFF_ID?.trim()
  const channel = process.env.LINE_CLIENT_ID?.trim()
  return id && channel && /^\d+-[A-Za-z0-9]+$/.test(id) && id.split('-')[0] === channel ? id : null
}

export function liffDestination(view: string | null): string {
  if (view === 'bulletin') return '/bulletin'
  return ['maps', 'week', 'handoffs'].includes(view || '') ? `/dashboard?view=${view}` : '/dashboard'
}
