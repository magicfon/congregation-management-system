// 簡單的內存存儲（用於演示）
// 生產環境請配置 Vercel Postgres

interface Territory {
  id: number
  code: string
  number: number | null
  responsible_brother: string | null
  split_date: string | null
  last_completed_date: string | null
  days_idle: number
  post_pandemic_completions: number
  status: string
  created_at: string
  updated_at: string
}

interface Schedule {
  id: number
  time_slot: string
  group_name: string | null
  leader: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Report {
  id: number
  timestamp: string
  publisher_name: string
  time_slot: string | null
  territory_id: number | null
  start_date: string | null
  notes: string | null
  created_at: string
}

// 內存存儲
let territories: Territory[] = [
  { id: 1, code: 'A-1', number: 1, responsible_brother: '王弟兄', split_date: '2024-01-15', last_completed_date: '2025-02-20', days_idle: 17, post_pandemic_completions: 3, status: 'active', created_at: '2024-01-15', updated_at: '2025-02-20' },
  { id: 2, code: 'A-2', number: 2, responsible_brother: '李弟兄', split_date: '2024-01-15', last_completed_date: '2024-12-01', days_idle: 98, post_pandemic_completions: 2, status: 'idle', created_at: '2024-01-15', updated_at: '2024-12-01' },
  { id: 3, code: 'B-1', number: 1, responsible_brother: '張弟兄', split_date: '2024-03-20', last_completed_date: '2025-03-01', days_idle: 8, post_pandemic_completions: 4, status: 'active', created_at: '2024-03-20', updated_at: '2025-03-01' },
  { id: 4, code: 'B-2', number: 2, responsible_brother: null, split_date: '2024-03-20', last_completed_date: '2024-10-15', days_idle: 145, post_pandemic_completions: 1, status: 'idle', created_at: '2024-03-20', updated_at: '2024-10-15' },
  { id: 5, code: 'C-1', number: 1, responsible_brother: '陳弟兄', split_date: '2024-06-01', last_completed_date: '2025-02-28', days_idle: 9, post_pandemic_completions: 5, status: 'active', created_at: '2024-06-01', updated_at: '2025-02-28' },
]

let schedules: Schedule[] = [
  { id: 1, time_slot: '週六上午', group_name: '第一組', leader: '王弟兄', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, time_slot: '週六下午', group_name: '第二組', leader: '李弟兄', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 3, time_slot: '週日上午', group_name: '第三組', leader: '張弟兄', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
]

let reports: Report[] = []

let nextTerritoryId = 6
let nextScheduleId = 4
let nextReportId = 1

// 導出函數
export async function getTerritories() {
  return territories
}

export async function getTerritoryById(id: number) {
  return territories.find(t => t.id === id)
}

export async function createTerritory(data: Partial<Territory>) {
  const territory: Territory = {
    id: nextTerritoryId++,
    code: data.code || '',
    number: data.number || null,
    responsible_brother: data.responsible_brother || null,
    split_date: data.split_date || null,
    last_completed_date: data.last_completed_date || null,
    days_idle: data.days_idle || 0,
    post_pandemic_completions: data.post_pandemic_completions || 0,
    status: data.status || 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  territories.push(territory)
  return territory
}

export async function updateTerritory(id: number, data: Partial<Territory>) {
  const index = territories.findIndex(t => t.id === id)
  if (index === -1) return null
  territories[index] = { ...territories[index], ...data, updated_at: new Date().toISOString() }
  return territories[index]
}

export async function deleteTerritory(id: number) {
  const index = territories.findIndex(t => t.id === id)
  if (index === -1) return false
  territories.splice(index, 1)
  return true
}

export async function getSchedules() {
  return schedules
}

export async function createSchedule(data: Partial<Schedule>) {
  const schedule: Schedule = {
    id: nextScheduleId++,
    time_slot: data.time_slot || '',
    group_name: data.group_name || null,
    leader: data.leader || null,
    is_active: data.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  schedules.push(schedule)
  return schedule
}

export async function getReports() {
  return reports
}

export async function createReport(data: Partial<Report>) {
  const report: Report = {
    id: nextReportId++,
    timestamp: new Date().toISOString(),
    publisher_name: data.publisher_name || '',
    time_slot: data.time_slot || null,
    territory_id: data.territory_id || null,
    start_date: data.start_date || null,
    notes: data.notes || null,
    created_at: new Date().toISOString(),
  }
  reports.push(report)
  
  // 更新區域狀態
  if (report.territory_id) {
    const territory = territories.find(t => t.id === report.territory_id)
    if (territory) {
      territory.last_completed_date = new Date().toISOString().split('T')[0]
      territory.days_idle = 0
      territory.status = 'active'
      territory.updated_at = new Date().toISOString()
    }
  }
  
  return report
}

export async function getStats() {
  const activeTerritories = territories.filter(t => t.status === 'active')
  const idleTerritories = territories.filter(t => t.status === 'idle')
  
  return {
    territories: {
      total: territories.length,
      active: activeTerritories.length,
      idle: idleTerritories.length,
      avg_days_idle: Math.round(territories.reduce((sum, t) => sum + t.days_idle, 0) / territories.length),
    },
    reports: {
      total: reports.length,
      this_week: reports.filter(r => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return new Date(r.timestamp) > weekAgo
      }).length,
      this_month: reports.filter(r => {
        const monthAgo = new Date()
        monthAgo.setDate(monthAgo.getDate() - 30)
        return new Date(r.timestamp) > monthAgo
      }).length,
    },
    schedules: {
      total: schedules.length,
      active: schedules.filter(s => s.is_active).length,
    },
    idleTerritories: territories
      .filter(t => t.days_idle > 30 || t.status === 'idle')
      .map(t => ({
        id: t.id,
        code: t.code,
        responsible_brother: t.responsible_brother,
        days_idle: t.days_idle,
        last_completed_date: t.last_completed_date,
        status: t.status,
      }))
      .sort((a, b) => b.days_idle - a.days_idle),
  }
}
