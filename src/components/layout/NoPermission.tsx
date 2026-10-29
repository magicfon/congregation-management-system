import Link from 'next/link'
import DashboardLayout from './DashboardLayout'

// 已登入但不是管理員時顯示，不直接導走（ADR-0093）。
export default function NoPermission({ title, publicHref, publicLabel }: { title: string; publicHref?: string; publicLabel?: string }) {
  return <DashboardLayout>
    <section className="mx-auto my-8 max-w-lg rounded-2xl border border-amber-300/20 bg-mc-card p-6 sm:p-8">
      <div aria-hidden="true" className="mb-4 text-3xl text-amber-300">⚿</div>
      <h1 className="text-xl font-semibold">沒有權限</h1>
      <p className="mt-3 text-sm leading-7 text-mc-text/70">「{title}」僅供管理員使用。如需權限，請與管理員確認。</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {publicHref && <Link href={publicHref} className="inline-flex min-h-11 items-center rounded-lg bg-mc-highlight px-5 text-sm">{publicLabel}</Link>}
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-5 text-sm">我的看板</Link>
      </div>
    </section>
  </DashboardLayout>
}
