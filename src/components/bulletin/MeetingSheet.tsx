'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import { sectionColors, sectionNames, timeline, type Meeting, type MeetingItem, type Highlight } from '@/lib/midweek'
import styles from './MeetingSheet.module.css'
export const markColor = (value: Highlight) => value === 'yellow' ? '#ffff00' : value === 'green' ? '#00ff00' : undefined
type Editor = {
  change: (patch: Partial<Meeting>) => void
  itemChange: (index: number, patch: Partial<MeetingItem>) => void
  settings: (index: number) => void
  members: { id: string; name: string }[]
}
function TextField({ value, label, onChange, placeholder = '' }: { value: string; label: string; onChange: (value: string) => void; placeholder?: string }) {
  return <span className={styles.textField}><span aria-hidden="true">{value || placeholder}{'\u200b'}</span><textarea rows={1} aria-label={label} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value.replace(/\n/g, ''))} /></span>
}
function NameField({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false)
  return <input aria-label={label} list={focused ? 'meeting-members' : undefined} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className={styles.nameField} value={value} placeholder="姓名" style={{ width: `${Math.max(2, Array.from(value || '姓名').length) + (focused ? 1.8 : .05)}em` }} onChange={e => onChange(e.target.value)} />
}
export default function MeetingSheet({ meeting, editor }: { meeting: Meeting; editor?: Editor }) {
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
      {editor && <datalist id="meeting-members">{editor.members.map(m => <option key={m.id} value={m.name} />)}</datalist>}
      {meeting.note && <p className={styles.note}><span style={{ background: markColor(meeting.noteHighlight) }}>{editor ? <TextField value={meeting.note} label="更新標示" onChange={note => editor.change({ note })} /> : meeting.note}</span></p>}
      <h2 className={styles.heading}>{editor ? <button type="button" className={styles.editable} aria-label="日期與整張節目表設定" onClick={() => editor.settings(-1)}>[{Number(month)}月{Number(day)}日]</button> : `[${Number(month)}月${Number(day)}日]`}｜每週閱讀經文：{editor ? <TextField value={meeting.reading} label="每週閱讀經文" onChange={reading => editor.change({ reading })} /> : meeting.reading}</h2>
      <div className={styles.chair}><small>主席：</small><span>{editor ? <>[<NameField value={meeting.chair} label="主席" onChange={chair => editor.change({ chair })} />]</> : meeting.chair && `[${meeting.chair}]`}</span></div>
      {rows.map((row, index) => <Fragment key={row.id}>
        {row.section !== 'opening' && rows[index - 1]?.section !== row.section && <div className={styles.section}><h3 style={{ background: sectionColors[row.section] }}>{sectionNames[row.section]}</h3>{row.section !== 'living' && <small>第一班</small>}</div>}
        <div className={styles.row} data-meeting-row={row.id}>
          <time><span style={{ background: markColor(row.timeHighlight ?? ''), color: row.timeHighlight ? 'red' : undefined }}>{editor ? <button type="button" className={styles.editable} aria-label={`${index + 1} 時間設定`} onClick={() => editor.settings(index === 0 ? -1 : index)}>{row.at}</button> : row.at}</span></time>
          <div className={styles.title}><span style={{ color: sectionColors[row.section] }}>●</span><span style={{ background: markColor(row.highlight), color: row.highlight ? 'red' : undefined }}>{editor ? <TextField value={row.title} label={`${index + 1} 節目名稱`} onChange={title => editor.itemChange(index, { title })} /> : row.title}{!row.title.startsWith('唱') && (row.minutes > 0 || editor) && <span className={styles.minutes}>（{editor ? <input aria-label={`${index + 1} 分鐘`} className={styles.minuteField} type="number" min={0} max={180} value={row.minutes} onChange={e => editor.itemChange(index, { minutes: Number(e.target.value) })} /> : row.minutes}分鐘）</span>}</span></div>
          <div className={styles.assignee}><small>{row.role && `${row.role}：`}</small><span><span style={{ background: markColor(row.personHighlight ?? '') }}>{editor && (row.role || row.person || row.assistant || (!row.title.startsWith('唱') && !/^(開場白|結語)/.test(row.title))) ? <>[<NameField value={row.person} label={`${index + 1} 負責人／學生`} onChange={person => editor.itemChange(index, { person })} />{(row.assistant || /助手|朗讀員/.test(row.role)) && <>/<NameField value={row.assistant} label={`${index + 1} 助手`} onChange={assistant => editor.itemChange(index, { assistant })} /></>}]</> : (row.person || row.assistant) && `[${[row.person, row.assistant].filter(Boolean).join('/')}]`}</span></span></div>
          {editor && <button type="button" aria-label={`${index + 1} 節目設定`} className={styles.rowSettings} onClick={() => editor.settings(index)}>⋯</button>}
        </div>
      </Fragment>)}
    </article></div></div>
  </div>
}
