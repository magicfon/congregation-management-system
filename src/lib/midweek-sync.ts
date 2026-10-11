import { randomUUID } from 'crypto'
import { prisma } from './db'
import { discoverIssues, discoverWeeks, discoverYears, fetchOfficial, INDEX_URL, parseWeek } from './midweek-import'
import { SOURCE_PREFIX } from './midweek-store'

type Task = { kind: 'index' | 'year' | 'issue' | 'week'; url: string; attempts: number }
type Failure = Task & { error: string }
export type SyncState = { month: string; completedAt: string | null; queue: Task[]; seen: string[]; done: number; imported: number; errors: Failure[] }
const stateKey = 'midweek:sync'
const lockKey = 'midweek:sync-lock'
export async function syncStatus() {
  const row = await prisma.setting.findUnique({ where: { key: stateKey } })
  const s: SyncState | null = row ? JSON.parse(row.value) : null
  return s ? { month: s.month, completedAt: s.completedAt, remaining: s.queue.length, done: s.done, imported: s.imported, errors: s.errors.map(e => ({ url: e.url, error: e.error })) } : null
}
// Daily cron continues a bounded batch; only one full source scan is started per Taipei calendar month.
export async function syncMidweek(force = false, budgetMs = 40000) {
  const owner = randomUUID(), now = Date.now()
  const token = JSON.stringify({ owner, until: now + 120000 })
  const oldLock = await prisma.setting.findUnique({ where: { key: lockKey } })
  if (oldLock) {
    if (JSON.parse(oldLock.value).until > now) return { ...await syncStatus(), busy: true }
    const result = await prisma.setting.updateMany({ where: { key: lockKey, value: oldLock.value }, data: { value: token } })
    if (!result.count) return { busy: true }
  } else {
    try { await prisma.setting.create({ data: { key: lockKey, value: token } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') return { busy: true }; throw error }
  }
  try {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit' }).format(new Date())
    const row = await prisma.setting.findUnique({ where: { key: stateKey } })
    let state: SyncState = row ? JSON.parse(row.value) : { month: '', completedAt: null, queue: [], seen: [], done: 0, imported: 0, errors: [] }
    if (!state.queue.length) {
      if (state.errors.length && state.month === month) {
        state.queue = state.errors.map(({ error: _error, ...t }) => ({ ...t, attempts: 0 })); state.errors = []
      } else {
        if (state.month === month && state.completedAt && !force) return await syncStatus()
        state = { month, completedAt: null, queue: [{ kind: 'index', url: INDEX_URL, attempts: 0 }], seen: [INDEX_URL], done: 0, imported: 0, errors: [] }
      }
    }
    const save = () => prisma.setting.upsert({ where: { key: stateKey }, create: { key: stateKey, value: JSON.stringify(state) }, update: { value: JSON.stringify(state) } })
    await save()
    const seen = new Set(state.seen)
    while (state.queue.length && Date.now() - now < budgetMs) {
      const batch = state.queue.splice(0, 4)
      const results = await Promise.allSettled(batch.map(async task => {
        const html = await fetchOfficial(task.url)
        if (task.kind === 'week') {
          const source = parseWeek(html, task.url)
          await prisma.setting.upsert({ where: { key: SOURCE_PREFIX + source.id }, create: { key: SOURCE_PREFIX + source.id, value: JSON.stringify(source) }, update: { value: JSON.stringify(source) } })
          return [] as Task[]
        }
        const kind = task.kind === 'index' ? 'year' : task.kind === 'year' ? 'issue' : 'week'
        const urls = task.kind === 'index' ? discoverYears(html) : task.kind === 'year' ? discoverIssues(html) : discoverWeeks(html, task.url)
        return urls.map(url => ({ kind, url, attempts: 0 } as Task))
      }))
      const discovered: Task[] = []
      results.forEach((result, i) => {
        const task = batch[i]
        if (result.status === 'fulfilled') {
          state.done++; if (task.kind === 'week') state.imported++
          const additions = result.value.filter(t => { if (seen.has(t.url)) return false; seen.add(t.url); return true })
          discovered.push(...additions)
        } else if (task.attempts < 2) state.queue.push({ ...task, attempts: task.attempts + 1 })
        else state.errors.push({ ...task, error: result.reason instanceof Error ? result.reason.message.slice(0, 250) : '匯入失敗' })
      })
      // Preserve newest-first discovery order while descending into issues.
      state.queue.unshift(...discovered)
      state.seen = [...seen]
      if (!state.queue.length && !state.errors.length) state.completedAt = new Date().toISOString()
      await save()
    }
    return await syncStatus()
  } finally {
    await prisma.setting.deleteMany({ where: { key: lockKey, value: token } })
  }
}
