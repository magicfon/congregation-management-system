'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { liffDestination } from '../../lib/liff-settings'

let initialization: Promise<typeof import('@line/liff').default> | undefined
function initialize(id: string) {
  if (!initialization) initialization = import('@line/liff').then(async ({ default: liff }) => {
    await liff.init({ liffId: id, withLoginOnExternalBrowser: true })
    return liff
  }).catch(error => { initialization = undefined; throw error })
  return initialization
}

export default function LiffEntry({ liffId }: { liffId: string | null }) {
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!liffId) return
    let active = true
    setError('')
    async function login() {
      try {
        const liff = await initialize(liffId!)
        if (!active) return
        // SDK must restore liff.state before reading the destination.
        const destination = liffDestination(new URLSearchParams(window.location.search).get('view'))
        if (destination === '/bulletin') { window.location.replace(destination); return }
        if (!liff.isLoggedIn()) return // SDK is redirecting to LINE authorization.
        const idToken = liff.getIDToken()
        if (!idToken) throw new Error('請確認 LIFF 已勾選 openid 權限')
        const result = await signIn('liff', { idToken, redirect: false, callbackUrl: destination })
        if (!active) return
        if (result?.error === 'LinePending') { window.location.replace('/pending-access?from=liff'); return }
        if (result?.error || !result?.ok) throw new Error('LINE 登入未完成，請重試或聯絡管理員')
        // Fixed destinations only; never redirect to a browser-provided URL.
        window.location.replace(destination)
      } catch (e) {
        if (active) setError(e instanceof Error && e.message.startsWith('請確認') ? e.message : 'LINE 登入未完成，請重試或聯絡管理員')
      }
    }
    void login()
    return () => { active = false }
  }, [liffId, retry])
  return <section className="mx-auto my-12 max-w-md rounded-2xl border border-white/10 bg-mc-card p-6 text-center">
    <h1 className="text-lg font-semibold">LINE 登入</h1>
    <p role="status" className="mt-4 text-sm text-mc-text/70">{!liffId ? 'LIFF 尚未設定' : error || '登入中…'}</p>
    {error && <button onClick={() => setRetry(value => value + 1)} className="mt-5 min-h-11 rounded-lg bg-[#06C755] px-6 text-white">重試</button>}
    {!liffId && <a href="/login" className="mt-5 block text-sm text-blue-300">一般網頁登入</a>}
  </section>
}
