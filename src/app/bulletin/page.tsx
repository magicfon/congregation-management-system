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
    <h1 className="sr-only">公布欄</h1>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {bulletinCategories.map(category => <Link key={category.slug} href={`/bulletin/${category.slug}`} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-mc-card p-3 transition-colors hover:border-blue-300/40 hover:bg-mc-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
        <span className="shrink-0 rounded-lg bg-blue-400/10 p-2 text-blue-300"><BulletinIcon icon={category.icon} /></span>
        <h2 className="flex-1 text-sm font-semibold">{category.title}</h2>
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-mc-text/30 group-hover:text-blue-300" />
      </Link>)}
    </div>
  </DashboardLayout>
}
