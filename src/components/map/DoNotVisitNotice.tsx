import { TriangleAlert } from 'lucide-react'
import { doNotVisitList } from '../../lib/do-not-visit-list'

/** 拒絕拜訪提示（ADR-0086）；沒有地址時不佔版面。 */
export default function DoNotVisitNotice({ text, className = '' }: { text: string; className?: string }) {
  const items = doNotVisitList(text)
  if (!items.length) return null
  return <section aria-label="拒絕拜訪" className={`rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-100 ${className}`}>
    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-200"><TriangleAlert size={16} aria-hidden="true" />拒絕拜訪 · {items.length} 筆</h2>
    <ul className="mt-2 space-y-1 text-sm">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul>
  </section>
}
