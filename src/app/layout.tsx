import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '會眾管理系統',
  description: 'Congregation Management System',
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
