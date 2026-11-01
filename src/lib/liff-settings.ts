export function configuredLiffId(): string | null {
  const id = process.env.LINE_LIFF_ID?.trim()
  const channel = process.env.LINE_CLIENT_ID?.trim()
  return id && channel && /^\d+-[A-Za-z0-9]+$/.test(id) && id.split('-')[0] === channel ? id : null
}

// LINE 選單開啟的頁面（ADR-0107）；其餘未知的 view 一律回看板。
const viewPages: Record<string, string> = {
  bulletin: '/bulletin', assignments: '/dashboard/assignments/service', territory: '/area-status',
  report: '/bulletin/territory-report', schedules: '/schedules', requests: '/map-requests',
  roster: '/service-roster/manage', midweek: '/midweek/manage', announcements: '/bulletin/announcements#manage-announcements', members: '/members',
}

export function liffDestination(view: string | null): string {
  if (view && Object.prototype.hasOwnProperty.call(viewPages, view)) return viewPages[view]
  return ['maps', 'week', 'handoffs'].includes(view || '') ? `/dashboard?view=${view}` : '/dashboard'
}

// Next.js has already decoded query values once. Only recover the view selector;
// never use liff.state itself (or its path/origin) as a redirect destination.
export function liffEntryDestination(params: { [key: string]: string | string[] | undefined }): string {
  const state = params['liff.state']
  if (state !== undefined) {
    if (typeof state !== 'string' || !/^(?:\?(?!\?)|\/(?![\/\\]))/.test(state)) return '/dashboard'
    const query = state.indexOf('?')
    const values = new URLSearchParams(query < 0 ? '' : state.slice(query + 1)).getAll('view')
    return liffDestination(values.length === 1 ? values[0] : null)
  }
  return liffDestination(typeof params.view === 'string' ? params.view : null)
}
