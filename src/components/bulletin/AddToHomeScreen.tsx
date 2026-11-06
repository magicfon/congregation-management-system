'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Copy, EllipsisVertical, ExternalLink, Share, SquarePlus } from 'lucide-react'

// 公布欄「加到手機桌面」（ADR-0117）。
// Android Chrome 用 beforeinstallprompt 一鍵安裝；iPhone 只能顯示步驟；
// LINE 等 App 內建瀏覽器不能加入主畫面，引導改用 Chrome／Safari 開啟。
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type Platform = 'in-app' | 'ios' | 'android' | 'other'
declare global { interface Window { __bulletinInstallPrompt?: InstallPrompt | null } }

export const ADD_TO_HOME_PARAM = 'add-to-home'
// 根 layout 的內嵌腳本先接住事件（可能早於 React 水合），再以此事件通知。
export const INSTALL_PROMPT_EVENT = 'bulletin-install-prompt'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua)) return 'in-app'
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function useAddToHomeScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const [platform, setPlatform] = useState<Platform>()
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [standalone, setStandalone] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setStandalone(isStandalone())
    const sync = () => setInstallPrompt(window.__bulletinInstallPrompt ?? null)
    const installed = () => { window.__bulletinInstallPrompt = null; sync(); setStandalone(true) }
    sync()
    window.addEventListener(INSTALL_PROMPT_EVENT, sync)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener(INSTALL_PROMPT_EVENT, sync); window.removeEventListener('appinstalled', installed) }
  }, [])

  // 從其他頁或 LINE 轉過來時帶 ?add-to-home=1：自動打開說明，並清掉參數，
  // 讓 iPhone 加入主畫面時存的是乾淨的公布欄首頁網址。
  useEffect(() => {
    if (pathname !== '/bulletin') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has(ADD_TO_HOME_PARAM)) return
    url.searchParams.delete(ADD_TO_HOME_PARAM)
    url.searchParams.delete('openExternalBrowser')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    if (!isStandalone()) setOpen(true)
  }, [pathname])

  const available = !standalone && platform !== undefined && (platform !== 'other' || installPrompt !== null)

  const start = useCallback(async () => {
    if (installPrompt && platform !== 'in-app') {
      window.__bulletinInstallPrompt = null
      setInstallPrompt(null)
      await installPrompt.prompt().catch(() => undefined)
      return
    }
    // iPhone 加入的是目前網址，所以先回公布欄首頁再顯示步驟。
    if (platform === 'ios' && pathname !== '/bulletin') { router.push(`/bulletin?${ADD_TO_HOME_PARAM}=1`); return }
    setOpen(true)
  }, [installPrompt, platform, pathname, router])

  const dialog = open && platform ? <AddToHomeDialog platform={platform} installPrompt={installPrompt} onClose={() => setOpen(false)} /> : null
  return { available, start, dialog }
}

function AddToHomeDialog({ platform, installPrompt, onClose }: { platform: Platform; installPrompt: InstallPrompt | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal() }, [])
  const homeUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/bulletin`
  const step = 'flex gap-3 rounded-xl bg-mc-card p-3 text-sm leading-6'
  const num = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-400/15 text-xs font-semibold text-blue-200'
  const icon = 'mx-0.5 inline h-4 w-4 align-[-3px] text-blue-300'
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400'

  async function install() {
    if (!installPrompt) return
    window.__bulletinInstallPrompt = null
    await installPrompt.prompt().catch(() => undefined)
    onClose()
  }
  async function copy() {
    try { await navigator.clipboard.writeText(homeUrl); setCopied(true) } catch { setCopied(false) }
  }

  let body: React.ReactNode
  if (platform === 'in-app') body = <>
    <p className="text-sm leading-6 text-mc-text/70">LINE 裡的瀏覽器不能加到桌面，請先改用手機的瀏覽器（Chrome 或 Safari）開啟公布欄。</p>
    <a href={`${homeUrl}?${ADD_TO_HOME_PARAM}=1&openExternalBrowser=1`} target="_blank" rel="noopener" className={`${button} w-full bg-blue-500 text-white hover:bg-blue-400`}><ExternalLink aria-hidden="true" className="h-4 w-4" />用瀏覽器開啟</a>
    <p className="text-sm leading-6 text-mc-text/70">沒有跳到瀏覽器的話，點右上角 <EllipsisVertical aria-label="選單" className={icon} /> 或 <Share aria-label="分享" className={icon} />，選「用預設瀏覽器開啟」；也可以複製網址貼到瀏覽器。</p>
    <button type="button" onClick={copy} className={`${button} w-full border border-white/15 hover:bg-mc-accent`}><Copy aria-hidden="true" className="h-4 w-4" />{copied ? '已複製網址' : '複製公布欄網址'}</button>
    <p className="text-xs leading-5 text-mc-text/50">在瀏覽器開啟後，再按右上角 ☰ 的「加到手機桌面」。</p>
  </>
  else if (platform === 'ios') body = <ol className="space-y-2">
    <li className={step}><span className={num}>1</span><span>點 Safari 下方（iPad 在右上）的分享按鈕 <Share aria-label="分享" className={icon} /></span></li>
    <li className={step}><span className={num}>2</span><span>往下滑，點「加入主畫面」<SquarePlus aria-hidden="true" className={icon} /></span></li>
    <li className={step}><span className={num}>3</span><span>按右上角「新增」，桌面就會出現公布欄</span></li>
  </ol>
  else if (installPrompt) body = <>
    <p className="text-sm leading-6 text-mc-text/70">按下面的按鈕，再按「安裝」就會加到桌面。</p>
    <button type="button" onClick={install} className={`${button} w-full bg-blue-500 text-white hover:bg-blue-400`}><SquarePlus aria-hidden="true" className="h-4 w-4" />加到桌面</button>
  </>
  else body = <ol className="space-y-2">
    <li className={step}><span className={num}>1</span><span>點瀏覽器右上角的 <EllipsisVertical aria-label="選單" className={icon} /> 選單</span></li>
    <li className={step}><span className={num}>2</span><span>選「加到主畫面」或「安裝應用程式」</span></li>
    <li className={step}><span className={num}>3</span><span>按「新增」或「安裝」確認</span></li>
  </ol>

  return <dialog ref={ref} aria-labelledby="add-to-home-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) ref.current?.close() }} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/15 bg-mc-bg p-5 text-mc-text shadow-2xl backdrop:bg-black/60">
    <div className="space-y-4">
      <h2 id="add-to-home-title" className="text-lg font-semibold">加到手機桌面</h2>
      {body}
      <button type="button" onClick={() => ref.current?.close()} className={`${button} w-full text-mc-text/70 hover:bg-mc-accent`}>關閉</button>
    </div>
  </dialog>
}
