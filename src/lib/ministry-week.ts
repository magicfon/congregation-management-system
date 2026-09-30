export type MinistryTask = { id: string; areaId: string; label: string; date: string; status: string }

/** Input is the server's Taipei calendar date; UTC here performs date-only arithmetic. */
export function ministryWeek(today: string, tasks: MinistryTask[]) {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date); d.setUTCDate(date.getUTCDate()+i)
    const value = key(d)
    return { date: value, label: ['週一','週二','週三','週四','週五','週六','週日'][i], tasks: tasks.filter(t => t.date === value) }
  })
  return { days, earlier: tasks.filter(t=>t.date<days[0].date), later: tasks.filter(t=>t.date>days[6].date) }
}
