'use client'
import { useEffect, useRef } from 'react'
import { comparableText, diffSources, sourceChangeCount, sectionNames, type Meeting, type SourceSnapshot, type SourceWeek } from '@/lib/midweek'

type Side = { section: keyof typeof sectionNames; title: string; minutes: number } | undefined
const cell = (side: Side, changed: boolean) => <td className={`w-1/2 border border-white/10 px-2 py-2 align-top ${changed ? 'bg-amber-400/15' : ''}`}>
  {side ? <><span className="block">{side.title}</span><span className="text-xs text-mc-text/60">{sectionNames[side.section] || '開場'}・{side.minutes}分鐘</span></> : <span className="text-mc-text/40">（沒有）</span>}
</td>
// 手冊更新後左右比對：左邊舊手冊（沒存到就用目前草稿），右邊最新手冊（ADR-0111）。
export default function SourceChanges({ snapshot, draft, source, onClose }: { snapshot?: SourceSnapshot; draft: Meeting; source: SourceWeek; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  const before = snapshot || draft
  const rows = diffSources(before, source)
  const readingChanged = comparableText(before.reading) !== comparableText(source.reading)
  const count = sourceChangeCount(before, source)
  return <dialog ref={dialog} aria-label="手冊更動" onCancel={onClose} onClose={onClose} className="m-auto max-h-[85dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-mc-bg p-4 text-mc-text shadow-2xl backdrop:bg-black/60 sm:p-6">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">手冊更動</h2><button className="min-h-11 rounded-lg border border-white/15 px-4 py-2" onClick={onClose}>關閉</button></div>
    <p className="mb-3 text-sm text-mc-text/70">{count ? `有 ${count} 處不同，已用黃色標出。` : '節目名稱、分鐘數與經文範圍都相同。'}只比對節目，不比對人員；方括號與全形／半形連字號不算差異。</p>
    {!snapshot && <p className="mb-3 text-sm text-amber-300">這週的舊手冊沒有保存，左邊改用目前草稿，你自己改過的節目也會標成不同。</p>}
    <table className="w-full table-fixed border-collapse text-sm">
      <thead><tr><th className="border border-white/10 px-2 py-2 text-left">{snapshot ? '舊手冊' : '目前草稿'}</th><th className="border border-white/10 px-2 py-2 text-left">最新手冊</th></tr></thead>
      <tbody>
        <tr>{[before.reading, source.reading].map((reading, i) => <td key={i} className={`border border-white/10 px-2 py-2 align-top ${readingChanged ? 'bg-amber-400/15' : ''}`}><span className="text-xs text-mc-text/60">經文範圍</span><span className="block">{reading}</span></td>)}</tr>
        {rows.map((row, i) => <tr key={i}>{cell(row.old, row.changed)}{cell(row.new, row.changed)}</tr>)}
      </tbody>
    </table>
  </dialog>
}
