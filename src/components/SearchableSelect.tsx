'use client'

import { useEffect, useId, useRef, useState } from 'react'

type Option = { value: string; label: string; description?: string; searchText?: string }
type Props = {
  label: string; placeholder: string; value: string; options: Option[]; disabled?: boolean
  onChange: (value: string) => void
  onQueryChange?: (query: string) => void
}

export default function SearchableSelect({ label, placeholder, value, options, disabled, onChange, onQueryChange }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const list = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)
  const needle = query.trim().toLocaleLowerCase()
  const matches = options.filter(option => !needle || `${option.label} ${option.description || ''} ${option.searchText || ''}`.toLocaleLowerCase().includes(needle))
  const expanded = open && !disabled
  useEffect(() => {
    if (expanded && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, expanded])
  function choose(option: Option) {
    onChange(option.value); setQuery(''); setActive(-1); setOpen(false)
  }
  return <div className="min-w-0 flex-1" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1) }
  }}>
    <label htmlFor={id} className="mb-1 block text-xs text-mc-text/60">{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-list`} aria-activedescendant={expanded && matches[active] ? `${id}-option-${active}` : undefined}
      autoComplete="off" placeholder={placeholder} disabled={disabled} value={selected?.label ?? query}
      onFocus={() => { setOpen(true); setActive(-1) }}
      onChange={event => { setQuery(event.target.value); onQueryChange?.(event.target.value); onChange(''); setOpen(true); setActive(-1) }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true)
          setActive(previous => !matches.length ? -1 : event.key === 'ArrowDown' ? Math.min(previous + 1, matches.length - 1) : previous <= 0 ? matches.length - 1 : previous - 1)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (expanded && matches[active]) choose(matches[active])
        } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1) }
      }}
      className="min-h-11 w-full rounded-lg border border-white/10 bg-mc-accent px-3 text-sm text-mc-text outline-none focus:border-blue-400 disabled:opacity-40" />
    {expanded && <div className="mt-1 rounded-lg border border-white/15 bg-mc-card">
      <div ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="max-h-48 overflow-y-auto overscroll-contain">
        {matches.map((option, index) => <button key={option.value} id={`${id}-option-${index}`} type="button" role="option" aria-selected={option.value === value} tabIndex={-1}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}
          className={`block min-h-11 w-full break-words px-3 py-2 text-left text-sm text-mc-text hover:bg-white/10 ${index === active ? 'bg-blue-400/15' : ''}`}>
          <span className="block font-medium">{option.label}</span>
          {option.description && <span className="mt-0.5 block break-all text-xs text-mc-text/50">{option.description}</span>}
        </button>)}
      </div>
      {!matches.length && <p role="status" className="px-3 py-3 text-sm text-mc-text/50">沒有符合的人選</p>}
    </div>}
  </div>
}
