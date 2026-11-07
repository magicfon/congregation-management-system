'use client'
import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { createPortal } from 'react-dom'

// 週中編排姓名欄離開時，姓名不在成員名單就跳出確認；按「修改」回到輸入框（ADR-0118）。
export function useMemberNameCheck(members: { name: string }[]) {
  const [pending, setPending] = useState<{ name: string; input: HTMLInputElement } | null>(null)
  const accepted = useRef(new Set<string>())
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (pending && dialog.current && !dialog.current.open) dialog.current.showModal() }, [pending])
  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    const name = event.currentTarget.value.trim()
    if (!name || !members.length || accepted.current.has(name) || members.some(m => m.name.trim() === name)) return
    if (typeof document !== 'undefined' && !document.hasFocus()) return
    setPending({ name, input: event.currentTarget })
  }
  const close = (keep: boolean) => {
    const current = pending
    dialog.current?.close(); setPending(null)
    if (!current) return
    if (keep) accepted.current.add(current.name)
    else requestAnimationFrame(() => { current.input.focus(); current.input.select() })
  }
  const button = 'min-h-11 flex-1 rounded-lg border border-white/15 px-4 py-2'
  const element = pending && typeof document !== 'undefined' ? createPortal(
    <dialog ref={dialog} aria-label="姓名不在成員名單" onCancel={event => { event.preventDefault(); close(false) }} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/15 bg-mc-bg p-5 text-base text-mc-text shadow-2xl backdrop:bg-black/60">
      <p className="mb-5">「{pending.name}」不在成員名單中，確定要委派嗎？</p>
      <div className="flex gap-2"><button type="button" className={button} onClick={() => close(false)}>修改</button><button type="button" autoFocus className={`${button} bg-blue-600 font-semibold text-white`} onClick={() => close(true)}>確定</button></div>
    </dialog>, document.body) : null
  return { onBlur, dialog: element }
}
