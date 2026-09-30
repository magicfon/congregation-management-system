import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'

export default function PendingAccessPage() {
  return <DashboardLayout publicView>
    <section className="mx-auto my-8 max-w-lg rounded-2xl border border-amber-300/20 bg-mc-card p-6 sm:p-8">
      <div aria-hidden="true" className="mb-4 text-3xl text-amber-300">◷</div>
      <h1 className="text-xl font-semibold">待管理員確認權限</h1>
      <p className="mt-3 text-sm leading-7 text-mc-text/70">首次使用的 LINE 帳號需由管理員連結成員。請聯絡管理員確認您的 LINE 顯示名稱，連結完成後再登入。</p>
      <Link href="/login" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-mc-highlight px-5 text-sm">重新登入</Link>
    </section>
  </DashboardLayout>
}
