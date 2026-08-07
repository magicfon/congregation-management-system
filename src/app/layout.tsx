import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '地圖分配系統',
  description: 'Territory Assignment System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-mc-bg text-mc-text antialiased">
        {children}
      </body>
    </html>
  )
}
