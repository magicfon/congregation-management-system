import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { bulletinCategories } from '@/lib/bulletin'
import PdfReader from '@/components/bulletin/PdfReader'
import Midweek from '@/components/bulletin/Midweek'

// 嵌入外部網站（Google 協作平台）用的無邊框版本：不包 DashboardLayout、無標頭，固定淺色（ADR-0084、ADR-0085）。
const embeddable = ['public-talks', 'midweek-meeting']

type Props = { params: { category: string } }
export function generateStaticParams() { return embeddable.map(category => ({ category })) }
export function generateMetadata({ params }: Props): Metadata {
  const category = bulletinCategories.find(item => item.slug === params.category)
  return { title: category ? `${category.title}｜楠梓會眾公布欄` : '找不到分類｜楠梓會眾公布欄', robots: { index: false } }
}

export default function BulletinEmbedPage({ params }: Props) {
  const category = bulletinCategories.find(item => item.slug === params.category)
  if (!category || !embeddable.includes(category.slug)) notFound()
  if (category.slug === 'midweek-meeting') return <main className="bulletin-embed fixed inset-0 overflow-auto bg-mc-bg p-2 text-mc-text sm:p-4">
    <Midweek embedded />
  </main>
  const source = category.sources.find(item => item.pdf)
  if (!source?.pdf) notFound()
  return <main className="bulletin-embed fixed inset-0 overflow-hidden bg-mc-bg text-mc-text">
    <PdfReader id={source.pdf} label={source.label} embedded />
  </main>
}
