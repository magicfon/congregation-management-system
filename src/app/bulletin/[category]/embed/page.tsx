import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { bulletinCategories } from '@/lib/bulletin'
import PdfReader from '@/components/bulletin/PdfReader'

// 嵌入外部網站（Google 協作平台）用的無邊框版本：不包 DashboardLayout、無標頭，固定淺色（ADR-0084）。
const embeddable = ['public-talks']

type Props = { params: { category: string } }
export function generateStaticParams() { return embeddable.map(category => ({ category })) }
export function generateMetadata({ params }: Props): Metadata {
  const category = bulletinCategories.find(item => item.slug === params.category)
  return { title: category ? `${category.title}｜楠梓會眾公布欄` : '找不到分類｜楠梓會眾公布欄', robots: { index: false } }
}

export default function BulletinEmbedPage({ params }: Props) {
  const category = bulletinCategories.find(item => item.slug === params.category)
  const source = category?.sources.find(item => item.pdf)
  if (!category || !embeddable.includes(category.slug) || !source?.pdf) notFound()
  return <main className="bulletin-embed fixed inset-0 overflow-hidden bg-mc-bg text-mc-text">
    <PdfReader id={source.pdf} label={source.label} embedded />
  </main>
}
