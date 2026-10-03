import { serviceRoles, type ServiceWeekData } from './service-roster'

export function overviewWeeks(weeks: ServiceWeekData[], today: string, personId = '') {
  const matching = weeks.filter(week => !personId || (!week.stopped && serviceRoles.some(role => week.assignments[role.id]?.personId === personId)))
    .slice().sort((a, b) => a.startDate.localeCompare(b.startDate))
  return {
    upcoming: matching.filter(week => week.endDate >= today),
    past: matching.filter(week => week.endDate < today).reverse(),
  }
}

export function overviewDuties(week: ServiceWeekData, personId = '') {
  if (week.stopped) return []
  return serviceRoles.filter(role => !personId || week.assignments[role.id]?.personId === personId)
}
