export const serviceRoles = [
  { id: 'host', label: '招待當值', group: '招待' }, { id: 'backup', label: '替補招待', group: '招待' }, { id: 'attendant', label: '會堂招待員', group: '招待' },
  { id: 'watchtower', label: '守望台朗讀', group: '週末聚會' },
  { id: 'micA', label: '麥克風 A', group: '設備服務' }, { id: 'micB', label: '麥克風 B', group: '設備服務' }, { id: 'stage', label: '講台', group: '設備服務' }, { id: 'video', label: '影像', group: '設備服務' }, { id: 'audio', label: '音響', group: '設備服務' },
  { id: 'chair', label: '週中主席', group: '週中聚會' }, { id: 'reader', label: '週中朗讀', group: '週中聚會' },
] as const
export type ServiceRole = typeof serviceRoles[number]['id']
export type Assignment = { personId: string; name: string }
export type Assignments = Partial<Record<ServiceRole, Assignment>>
export type ServiceWeekData = { startDate: string; endDate: string; stopped: boolean; note: string; assignments: Assignments }
export type ServicePersonData = { id: string; name: string; memberId: string | null; enabled: boolean; roles: ServiceRole[] }
export const autoRoles: ServiceRole[] = ['micA', 'micB', 'stage', 'video', 'audio']
export function roleCategory(role: ServiceRole) { return role === 'micA' || role === 'micB' ? 'mic' : role }
export function dateDay(date: Date) { return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
export function addDays(day: string, days: number) { const date = new Date(`${day}T04:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateDay(date) }
export function validMonday(day: unknown): day is string { return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateDay(new Date(`${day}T04:00:00Z`)) === day && new Date(`${day}T04:00:00Z`).getUTCDay() === 1 }
export function weekLabel(day: string) {
  const date = new Date(`${day}T04:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 3)
  const year = date.getUTCFullYear()
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1, 4)) / 86400000 + 1) / 7)
  return `${year} W${week}`
}
export class RosterError extends Error {}

export function assignmentConflicts(assignments: Assignments): string[] {
  const warnings: string[] = []
  const entries = Object.entries(assignments) as [ServiceRole, Assignment][]
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const [a, pa] = entries[i], [b, pb] = entries[j]
    if (pa.personId !== pb.personId || a === 'backup' || b === 'backup') continue
    const mid = (role: ServiceRole) => role === 'chair' || role === 'reader'
    if (autoRoles.includes(a) || autoRoles.includes(b) || mid(a) === mid(b)) warnings.push(`${pa.name}：${serviceRoles.find(r => r.id === a)!.label}與${serviceRoles.find(r => r.id === b)!.label}重複`)
  }
  return warnings
}

export function validateAssignments(value: unknown, previous: Assignments, people: ServicePersonData[]): Assignments {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RosterError('安排格式錯誤')
  const result: Assignments = {}
  for (const [key, assignment] of Object.entries(value)) {
    if (!serviceRoles.some(role => role.id === key)) throw new RosterError('未知職務')
    const role = key as ServiceRole
    if (assignment === null) continue
    if (!assignment || typeof assignment !== 'object' || typeof assignment.personId !== 'string') throw new RosterError('人選格式錯誤')
    if (previous[role]?.personId === assignment.personId) { result[role] = previous[role]; continue }
    const person = people.find(p => p.id === assignment.personId)
    if (!person?.enabled || !person.memberId || !person.roles.includes(role)) throw new RosterError(`${serviceRoles.find(r => r.id === role)!.label}人選尚未具備資格`)
    result[role] = { personId: person.id, name: person.name }
  }
  const old = new Set(assignmentConflicts(previous))
  const conflicts = assignmentConflicts(result).filter(message => !old.has(message))
  if (conflicts.length) throw new RosterError(conflicts[0])
  return result
}

// Minimum-cost matching fills as many slots as possible without using a person twice.
export function fillServiceVacancies(week: ServiceWeekData, people: ServicePersonData[], history: ServiceWeekData[]) {
  if (week.stopped) return { assignments: week.assignments, warnings: ['本週停排'], filled: 0 }
  const assignments = { ...week.assignments }
  const roles = autoRoles.filter(role => !assignments[role])
  const used = new Set(Object.entries(assignments).filter(([role]) => role !== 'backup').map(([, value]) => value!.personId))
  const candidates = people.filter(p => p.enabled && p.memberId && !used.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
  const before = history.filter(w => !w.stopped && w.startDate < week.startDate)
  const cost = (person: ServicePersonData, role: ServiceRole) => {
    let same = 0, total = 0, recent = 0, consecutive = 0
    for (const previous of before) {
      const distance = Math.round((Date.parse(week.startDate) - Date.parse(previous.startDate)) / 604800000)
      for (const [key, value] of Object.entries(previous.assignments) as [ServiceRole, Assignment][]) {
        if (!autoRoles.includes(key) || value.personId !== person.id) continue
        total++
        if (roleCategory(key) !== roleCategory(role)) continue
        same++; recent += distance <= 12 ? 1 : distance <= 24 ? 0.5 : 0.2
        consecutive += distance === 1 ? 1000 : distance === 2 ? 50 : 0
      }
    }
    return same * 10 + total * 3 + recent * 5 + consecutive
  }
  type Edge = { to: number; reverse: number; capacity: number; cost: number }
  const end = 1 + roles.length + candidates.length, graph: Edge[][] = Array.from({ length: end + 1 }, () => [])
  const add = (from: number, to: number, value: number) => {
    graph[from].push({ to, reverse: graph[to].length, capacity: 1, cost: value })
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, cost: -value })
  }
  roles.forEach((role, i) => { add(0, i + 1, 0); candidates.forEach((p, j) => { if (p.roles.includes(role)) add(i + 1, 1 + roles.length + j, cost(p, role)) }) })
  candidates.forEach((_, j) => add(1 + roles.length + j, end, 0))
  let filled = 0
  while (true) {
    const distance = Array(graph.length).fill(Infinity), path: [number, number][] = Array(graph.length)
    distance[0] = 0
    for (let iteration = 0; iteration < graph.length - 1; iteration++) {
      let changed = false
      graph.forEach((edges, from) => edges.forEach((edge, i) => { if (edge.capacity && distance[from] + edge.cost < distance[edge.to]) { distance[edge.to] = distance[from] + edge.cost; path[edge.to] = [from, i]; changed = true } }))
      if (!changed) break
    }
    if (!path[end]) break
    for (let to = end; to !== 0;) { const [from, i] = path[to], edge = graph[from][i]; edge.capacity--; graph[to][edge.reverse].capacity++; to = from }
    filled++
  }
  roles.forEach((role, i) => {
    const selected = graph[i + 1].find(e => e.to > roles.length && e.to < end && e.capacity === 0)
    if (selected) { const p = candidates[selected.to - 1 - roles.length]; assignments[role] = { personId: p.id, name: p.name } }
  })
  return { assignments, filled, warnings: roles.filter(role => !assignments[role]).map(role => `${serviceRoles.find(r => r.id === role)!.label}：沒有可用人選`) }
}
