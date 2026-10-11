'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import { sectionColors, sectionNames, timeline, type Meeting, type Highlight } from '@/lib/midweek'
import styles from './MeetingSheet.module.css'
export const markColor = (value: Highlight) => value === 'yellow' ? '#ffff00' : value === 'green' ? '#00ff00' : undefined
export default function MeetingSheet({ meeting }: { meeting: Meeting }) {
  const viewport = useRef<HTMLDivElement>(null), sheet = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(1200), [height, setHeight] = useState(1400), [zoom, setZoom] = useState<number | null>(null)
  useEffect(() => {
    const observer = new ResizeObserver(() => { if (viewport.current) setWidth(viewport.current.clientWidth); if (sheet.current) setHeight(sheet.current.offsetHeight) })
    if (viewport.current) observer.observe(viewport.current)
    if (sheet.current) observer.observe(sheet.current)
    return () => observer.disconnect()
  }, [])
  const scale = zoom ?? Math.min(1, width / 1200)
  const rows = timeline(meeting)
  const [, month, day] = meeting.date.split('-')
  return <div>
    <div className="mb-2 flex items-center justify-end gap-2 text-sm"><button aria-label="縮小節目表" className="min-h-11 rounded border border-white/15 px-3" onClick={() => setZoom(Math.max(.25, scale - .15))}>－</button><span>{Math.round(scale * 100)}%</span><button aria-label="放大節目表" className="min-h-11 rounded border border-white/15 px-3" onClick={() => setZoom(Math.min(1.5, scale + .15))}>＋</button><button className="min-h-11 rounded border border-white/15 px-3" onClick={() => setZoom(null)}>適合寬度</button></div>
    <div ref={viewport} className={styles.viewport} tabIndex={0} aria-label="週中聚會節目表，可放大及左右捲動">
    <div style={{ width: 1200 * scale, height: height * scale, margin: 'auto', position: 'relative' }}>
    <article ref={sheet} className={styles.sheet} style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {meeting.note && <p className={styles.note}><span style={{ background: markColor(meeting.noteHighlight) }}>{meeting.note}</span></p>}
      <h2 className={styles.heading}>[{Number(month)}月{Number(day)}日]｜每週閱讀經文：{meeting.reading}</h2>
      <div className={styles.chair}><small>主席：</small><span>{meeting.chair && `[${meeting.chair}]`}</span></div>
      {rows.map((row, index) => <Fragment key={row.id}>
        {row.section !== 'opening' && rows[index - 1]?.section !== row.section && <div className={styles.section}><h3 style={{ background: sectionColors[row.section] }}>{sectionNames[row.section]}</h3>{row.section !== 'living' && <small>第一班</small>}</div>}
        <div className={styles.row}>
          <time><span style={{ background: markColor(row.timeHighlight ?? ''), color: row.timeHighlight ? 'red' : undefined }}>{row.at}</span></time>
          <div className={styles.title}><span style={{ color: sectionColors[row.section] }}>●</span><span style={{ background: markColor(row.highlight), color: row.highlight ? 'red' : undefined }}>{row.title}{!row.title.startsWith('唱') && row.minutes > 0 && <span className={styles.minutes}>（{row.minutes}分鐘）</span>}</span></div>
          <div className={styles.assignee}><small>{row.role && `${row.role}：`}</small><span><span style={{ background: markColor(row.personHighlight ?? '') }}>{(row.person || row.assistant) && `[${[row.person, row.assistant].filter(Boolean).join('/')}]`}</span></span></div>
        </div>
      </Fragment>)}
    </article></div></div>
  </div>
}
