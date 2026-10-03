import type { ServiceRole } from '@/lib/service-roster'

// Original 28-unit drawings: broad silhouettes and rounded strokes stay clear
// at label size. Text beside each icon carries its accessible name.
const drawings = {
  welcome: <><circle cx="12" cy="7" r="3.5" /><path d="M5 24v-6a7 7 0 0 1 14 0v6M19 16l5-5V7M9 19v5" /><path d="m11 15 1 3 1-3" /></>,
  backup: <><circle cx="10" cy="8" r="3.5" /><path d="M3 24v-5a7 7 0 0 1 11-5.7M19 4a4 4 0 0 1 0 8" /><circle cx="20" cy="20" r="6" /><path d="m17 20 2 2 4-4" /></>,
  entrance: <><path d="M16 25V4h9v21M21 14h.1M3 25h22" /><circle cx="7" cy="9" r="3" /><path d="M3 21v-4a4 4 0 0 1 8 0v4M11 17h5" /></>,
  book: <><path d="M14 7C10 4 6 4 2.5 5v17c4-1 8 0 11.5 3 3.5-3 7.5-4 11.5-3V5C22 4 18 4 14 7Zm0 0v18" /><path d="m6 10 4 1m-4 4 4 1m8-5 4-1m-4 6 4-1" /></>,
  microphone: <g transform="rotate(35 14 14)"><rect x="9" y="2.5" width="10" height="13" rx="5" fill="currentColor" fillOpacity=".12" /><path d="M11 15.5v9h6v-9M10 9h8M13 20h2" /></g>,
  lectern: <><path d="M5 10h15l4 5H9Zm6 5 2 9m7-9-2 9M9 25h13M8 10V6a3 3 0 0 1 3-3h2" /><path d="M13 3h3" strokeWidth="3.5" /><path d="M11 15h9l-2 9h-5Z" fill="currentColor" fillOpacity=".12" /></>,
  mixer: <><rect x="2.5" y="4" width="23" height="21" rx="3" /><path d="M8 8v3m0 5v5M14 8v8m0 5h0M20 8v1m0 5v7" /><path d="M6 13h4m2 5h4m2-7h4" strokeWidth="3.5" /></>,
  screen: <><rect x="2.5" y="3.5" width="23" height="17" rx="2.5" /><path d="M14 21v4m-5 0h10" /><path d="m11 8 7 4-7 4Z" fill="currentColor" strokeLinejoin="round" /></>,
  chairman: <><circle cx="12" cy="6.5" r="3.5" /><path d="M5 16v-1a7 7 0 0 1 14 0v1M4 17h19l-2 4H6Zm4 4v4h11v-4M22 17V9l3-2" /><path d="M8 21h11v4H8Z" fill="currentColor" fillOpacity=".12" /></>,
}
const roleDrawing: Record<ServiceRole, keyof typeof drawings> = {
  host: 'welcome', backup: 'backup', attendant: 'entrance',
  watchtower: 'book', reader: 'book', micA: 'microphone', micB: 'microphone',
  stage: 'lectern', audio: 'mixer', video: 'screen', chair: 'chairman',
}

export default function ServiceDutyIcon({ role }: { role: ServiceRole }) {
  return <svg data-duty-icon={role} aria-hidden="true" focusable="false" viewBox="0 0 28 28" width="24" height="24" className="mt-0.5 h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {drawings[roleDrawing[role]]}
  </svg>
}
