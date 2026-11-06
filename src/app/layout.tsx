import type { Metadata } from 'next'
import './globals.css'
import AppearanceProvider from '@/components/layout/AppearanceProvider'

export const metadata: Metadata = {
  title: { default: '楠梓會眾', template: '%s｜楠梓會眾' },
  description: '楠梓會眾管理系統：公布欄、地圖分配、服務安排與週中聚會編排。',
  // 加到手機桌面（ADR-0117）：manifest 由 src/app/manifest.ts 產生。
  appleWebApp: { capable: true, title: '公布欄', statusBarStyle: 'black' },
  icons: { icon: '/icons/bulletin-192.png', apple: '/apple-touch-icon.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="bulletin-theme dashboard-theme" suppressHydrationWarning>
      <head>
        {/* Apply the saved appearance before first paint (ADR-0072). */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.bulletinTheme=localStorage.getItem('bulletin-theme')||'system'}catch(e){}` }} />
        {/* Android 安裝提示可能早於 React 水合觸發，先接住留給「加到手機桌面」（ADR-0117）。 */}
        <script dangerouslySetInnerHTML={{ __html: `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bulletinInstallPrompt=e;dispatchEvent(new Event('bulletin-install-prompt'))})` }} />
      </head>
      <body className="bg-mc-bg text-mc-text antialiased">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  )
}
