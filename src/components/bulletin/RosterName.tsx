import type { Assignment } from '@/lib/service-roster'

export default function RosterName({ assignment, ownPersonId }: { assignment?: Assignment; ownPersonId: string | null }) {
  if (!assignment) return <span className="text-2xl leading-9 text-mc-text/70">待安排</span>
  if (ownPersonId && assignment.personId === ownPersonId) return <mark className="inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-lg bg-amber-400/20 px-2 py-1 text-2xl font-bold leading-9 text-mc-text ring-2 ring-amber-500/60">
    <span className="min-w-0 break-words">{assignment.name}</span><span className="text-base font-semibold">我</span>
  </mark>
  return <span className="break-words text-2xl font-semibold leading-9">{assignment.name}</span>
}
