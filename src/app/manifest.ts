import type { MetadataRoute } from 'next'

// 公布欄加到手機桌面（ADR-0117）：桌面捷徑固定開公布欄首頁，像 App 一樣全螢幕。
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/bulletin',
    name: '楠梓會眾公布欄',
    short_name: '公布欄',
    description: '聚會節目、會眾公告與傳道安排，免登入即可查看。',
    start_url: '/bulletin',
    scope: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#1e40af',
    lang: 'zh-TW',
    icons: [
      { src: '/icons/bulletin-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/bulletin-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/bulletin-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
