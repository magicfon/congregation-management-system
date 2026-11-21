import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { bulletinCategories } from '@/lib/bulletin'
import PdfReader from '@/components/bulletin/PdfReader'
import Midweek from '@/components/bulletin/Midweek'
import TerritoryReport from '@/components/bulletin/TerritoryReport'

// 嵌入外部網站（Google 協作平台）用的無邊框版本：不包 DashboardLayout、無標頭，固定淺色（ADR-0084、ADR-0085、ADR-0136、ADR-0138）。
const embeddable = ['public-talks', 'midweek-meeting', 'ministry-groups', 'territory-report']
// 這些嵌入頁不顯示捲軸：內容隨框寬縮放，捲軸時有時無會讓寬度來回跳而抖動（ADR-0114、ADR-0136）。
const noScrollbar = ['ministry-groups']

type Props = { params: { category: string } }
export function generateStaticParams() { return embeddable.map(category => ({ category })) }
export function generateMetadata({ params }: Props): Metadata {
  const category = bulletinCategories.find(item => item.slug === params.category)
  return { title: { absolute: category ? `${category.title}｜楠梓會眾公布欄` : '找不到分類｜楠梓會眾公布欄' }, robots: { index: false } }
}

export default function BulletinEmbedPage({ params }: Props) {
  const category = bulletinCategories.find(item => item.slug === params.category)
  if (!category || !embeddable.includes(category.slug)) notFound()
  if (category.slug === 'midweek-meeting') return <main className="bulletin-embed bulletin-embed-no-scrollbar fixed inset-0 overflow-auto bg-mc-bg p-2 text-mc-text sm:p-4">
    <Midweek embedded />
  </main>
  // 區域回報嵌入版：iframe 內帶不到登入，一律以免登入（自填姓名）回報（ADR-0078、ADR-0138）。
  if (category.slug === 'territory-report') return <main className="bulletin-embed bulletin-embed-no-scrollbar fixed inset-0 overflow-auto bg-mc-bg p-2 text-mc-text sm:p-4">
    <div className="mx-auto max-w-2xl"><TerritoryReport formUrl={category.sources[0].url} embedded /></div>
  </main>
  const source = category.sources.find(item => item.pdf)
  if (!source?.pdf) notFound()
  return <main className={`bulletin-embed ${noScrollbar.includes(category.slug) ? 'bulletin-embed-no-scrollbar ' : ''}fixed inset-0 overflow-hidden bg-mc-bg text-mc-text`}>
    <PdfReader id={source.pdf} label={source.label} embedded />
  </main>
}
