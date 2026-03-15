export type LiffProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

/**
 * Initialize LIFF and return the logged-in user's LINE profile.
 * If the user is not logged in, redirects to LINE OAuth (page leaves).
 * Must only be called client-side.
 */
export async function initAndGetProfile(): Promise<LiffProfile> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) {
    throw new Error('NEXT_PUBLIC_LIFF_ID 環境變數未設定')
  }

  // Dynamic import prevents SSR bundling errors
  const liff = (await import('@line/liff')).default

  await liff.init({ liffId })

  if (!liff.isLoggedIn()) {
    // login() redirects the page to LINE OAuth; execution stops here
    liff.login({ redirectUri: window.location.href })
    throw new Error('LINE_REDIRECT')
  }

  return liff.getProfile()
}
