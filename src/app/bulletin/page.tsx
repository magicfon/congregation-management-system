import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import BulletinIcon from '@/components/bulletin/BulletinIcon'
import { bulletinCategories } from '@/lib/bulletin'
import ReaderWarmup from '@/components/bulletin/ReaderWarmup'

export const metadata: Metadata = { title: '楠梓會眾公布欄', description: '聚會節目、會眾公告與傳道安排，免登入即可查看。' }

export default function BulletinPage() {
  return <DashboardLayout publicView>
    <ReaderWarmup />
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-blue-300/15 bg-mc-card px-6 py-10 md:px-10 md:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <p className="relative mb-4 text-xs tracking-[0.2em] text-blue-300">楠梓會眾 · 聚會與傳道</p>
      <h1 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">一起做好準備</h1>
      <p className="relative mt-4 max-w-lg text-sm leading-7 text-mc-text/60 sm:text-base">聚會節目、服務安排與傳道資訊，<br className="sm:hidden" />從這裡開始查看。</p>
      <div className="relative mt-7 flex flex-wrap gap-3">
        <Link href="/bulletin/midweek-meeting" className="flex min-h-12 items-center gap-3 rounded-xl bg-blue-500 px-5 text-sm font-medium text-white hover:bg-blue-600">查看週中聚會 <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        <Link href="/bulletin/meeting-points" className="flex min-h-12 items-center rounded-xl border border-white/15 px-5 text-sm hover:bg-mc-accent">傳道集合地點</Link>
      </div>
    </section>
    <div className="mb-5 flex items-end justify-between gap-4"><h2 className="text-lg font-semibold">公布欄</h2><span className="text-xs text-mc-text/50">選擇分類查看</span></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bulletinCategories.map(category => <Link key={category.slug} href={`/bulletin/${category.slug}`} className="group rounded-2xl border border-white/10 bg-mc-card p-5 transition-colors hover:border-blue-300/40 hover:bg-mc-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><span className="rounded-xl bg-blue-400/10 p-3 text-blue-300"><BulletinIcon icon={category.icon} /></span><ArrowUpRight aria-hidden="true" className="h-5 w-5 text-mc-text/30 group-hover:text-blue-300" /></div>
        <h3 className="text-base font-semibold leading-7">{category.title}</h3>
        <p className="mt-2 text-sm leading-6 text-mc-text/55">{category.description}</p>
      </Link>)}
    </div>
    <p className="mt-7 text-xs leading-6 text-mc-text/50">內容沿用會眾既有的 Google 文件與表格，更新後可在各分類查看。</p>
  </DashboardLayout>
}
