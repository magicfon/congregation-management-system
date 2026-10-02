'use client'
import { useState } from 'react'
export default function RosterReference({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer py-3 text-sm text-mc-text/60">Google 原表與組織表</summary>{open && children}</details>
}
