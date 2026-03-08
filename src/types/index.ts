export interface Territory {
  id: number
  code: string
  number: number | null
  responsible_brother: string | null
  split_date: string | null
  last_completed_date: string | null
  days_idle: number | null
  post_pandemic_completions: number | null
  status: 'active' | 'idle' | 'completed'
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: number
  time_slot: string
  group_name: string | null
  leader: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Report {
  id: number
  timestamp: string
  publisher_name: string
  time_slot: string | null
  territory_id: number | null
  start_date: string | null
  notes: string | null
  created_at: string
}

export interface Person {
  id: number
  name: string
  role: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
