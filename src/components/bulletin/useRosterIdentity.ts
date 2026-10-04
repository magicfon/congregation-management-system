'use client'

import { useEffect, useState } from 'react'

export default function useRosterIdentity() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    let request: AbortController | undefined
    async function refresh() {
      request?.abort()
      const controller = new AbortController()
      request = controller
      setPersonId(null)
      setSignedIn(false)
      try {
        const response = await fetch('/api/service-roster/me', { cache: 'no-store', signal: controller.signal })
        const identity = response.ok ? await response.json() : null
        if (!controller.signal.aborted) {
          setPersonId(typeof identity?.personId === 'string' ? identity.personId : null)
          setSignedIn(response.ok)
        }
      } catch { /* Public reading works without a personal identity. */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      request?.abort()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return { personId, signedIn }
}
