import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import BulletinIcon from '@/components/bulletin/BulletinIcon'
import { bulletinCategories } from '@/lib/bulletin'
import PdfReader from '@/components/bulletin/PdfReader'
import Announcements from '@/components/bulletin/Announcements'

type Props = { params: { category: string } }
export function generateStaticParams() { return bulletinCategories.map(category => ({ category: category.slug })) }
export function generateMetadata({ params }: Props): Metadata {
  const category = bulletinCategories.find(item => item.slug === params.category)
  return { title: category ? `${category.title}｜楠梓會眾公布欄` : '找不到分類｜楠梓會眾公布欄' }
}

export default function BulletinCategoryPage({ params }: Props) {
  const category = bulletinCategories.find(item => item.slug === params.category)
  if (!category) notFound()
  return <DashboardLayout publicView>
    <Link href="/bulletin" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-mc-text/60 hover:text-blue-300"><ArrowLeft aria-hidden="true" className="h-4 w-4" />回公布欄</Link>
    <div className="mb-7 flex items-start gap-4">
      <span className="shrink-0 rounded-2xl bg-blue-400/10 p-3 text-blue-300"><BulletinIcon icon={category.icon} /></span>
      <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">{category.title}</h1>
    </div>
    <nav aria-label="公布欄分類" className="mb-8 flex flex-wrap gap-2">
      {bulletinCategories.map(item => <Link key={item.slug} href={`/bulletin/${item.slug}`} aria-current={item.slug === category.slug ? 'page' : undefined} className={`flex min-h-11 items-center rounded-xl border px-3 text-sm ${item.slug === category.slug ? 'border-blue-400/40 bg-blue-400/10 text-blue-200' : 'border-white/10 text-mc-text/60 hover:bg-mc-accent'}`}>{item.shortTitle}</Link>)}
    </nav>
    {category.slug === 'announcements' ? <Announcements originalUrl={category.sources[0].url} /> : <div className="space-y-5">
      {[...category.sources].sort((a, b) => Number(Boolean(b.pdf)) - Number(Boolean(a.pdf))).map(source => <section key={source.url} className="overflow-hidden rounded-2xl border border-white/10 bg-mc-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
          <h2 className="text-sm font-semibold leading-6 sm:text-base">{source.label}</h2>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-300/20 bg-blue-400/10 px-4 text-sm text-blue-200 hover:bg-blue-400/20">{category.slug === 'territory-report' ? '開啟回報表單' : category.slug === 'announcements' ? '查看原公告頁' : '開啟原文件'}<ExternalLink aria-hidden="true" className="h-4 w-4" /><span className="sr-only">（另開分頁）</span></a>
        </div>
        {source.pdf ? <PdfReader id={source.pdf} label={source.label} /> : source.embed ? <details className="px-4 pb-4"><summary className="cursor-pointer py-3 text-sm text-blue-200">展開 Google 補充資訊</summary><iframe title={source.label} src={source.embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-[70vh] min-h-[420px] w-full border-0 bg-white sm:min-h-[540px]" /></details> : <p className="px-4 pb-5 text-sm leading-7 text-mc-text/60 sm:px-6">{category.slug === 'announcements' ? '公告沿用原會眾公告頁，請點上方連結查看。' : category.slug === 'territory-report' ? '使用原有 Google 表單完成回報。' : '點上方連結查看完整文件。'}</p>}
      </section>)}
    </div>}
  </DashboardLayout>
}
