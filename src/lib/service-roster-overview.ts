import { serviceRoles, type ServiceRole, type ServiceWeekData } from './service-roster'

export const overviewTabs: { id: string; label: string; roles: ServiceRole[] }[] = [
  { id: 'microphones', label: '麥克風', roles: ['micA', 'micB'] },
  { id: 'hospitality', label: '招待', roles: ['host', 'backup', 'attendant'] },
  { id: 'equipment', label: '講台・音響・影像', roles: ['stage', 'audio', 'video'] },
  ...serviceRoles.filter(role => !['micA', 'micB', 'host', 'backup', 'attendant', 'stage', 'audio', 'video'].includes(role.id)).map(role => ({ id: role.id, label: role.label, roles: [role.id] })),
  { id: 'all', label: '全部工作', roles: serviceRoles.map(role => role.id) },
]

export function overviewWeeks(weeks: ServiceWeekData[], today: string, personId = '', roles: ServiceRole[] = serviceRoles.map(role => role.id)) {
  const matching = weeks.filter(week => !personId || (!week.stopped && roles.some(role => week.assignments[role]?.personId === personId)))
    .slice().sort((a, b) => a.startDate.localeCompare(b.startDate))
  return {
    upcoming: matching.filter(week => week.endDate >= today),
    past: matching.filter(week => week.endDate < today).reverse(),
  }
}

export function overviewDuties(week: ServiceWeekData, personId = '', roles: ServiceRole[] = serviceRoles.map(role => role.id)) {
  if (week.stopped) return []
  return serviceRoles.filter(role => roles.includes(role.id) && (!personId || week.assignments[role.id]?.personId === personId))
}
