import { Prisma, PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'

export const COMPLETION_SYNC_KEY = 'area_report_completion_synced_at'

/** Sheet dates are calendar dates in Taipei, independent of server timezone. */
export function parseCompletionDate(value: unknown, now = new Date()): Date | null {
  const text = String(value ?? '').trim()
  if (!text || text === '0') return null
  let date: Date
  const parts = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (parts) {
    const canonical = `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`
    date = new Date(`${canonical}T00:00:00+08:00`)
    if (!Number.isFinite(date.getTime()) || taipeiDate(date) !== canonical) throw new Error(`無效的完成日期：${text}`)
  } else if (/^\d+(\.\d+)?$/.test(text) && Number(text) >= 1) {
    date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86400000 - 8 * 3600000)
  } else {
    throw new Error(`無法解析完成日期：${text}`)
  }
  if (!Number.isFinite(date.getTime()) || taipeiDate(date) > taipeiDate(now)) throw new Error(`完成日期晚於今天：${text}`)
  return date
}

export function completionRows(rows: string[][], now = new Date()) {
  const values = new Map<number, Date | null>()
  for (const row of rows) {
    const no = Number(row[1])
    if (!Number.isInteger(no) || no < 1 || no > 213 || values.has(no)) throw new Error('回報日期同步需要完整且不重複的 1–213 區')
    values.set(no, parseCompletionDate(row[4], now))
  }
  if (values.size !== 213) throw new Error('回報日期同步需要完整 213 區，已保留原資料')
  return values
}

export async function syncReportCompletions(db: PrismaClient, rows: string[][], now = new Date()) {
  const values = completionRows(rows, now)
  return db.$transaction(async (tx) => {
    const count = await tx.area.count({ where: { sheetNo: { in: [...values.keys()] } } })
    if (count !== 213) throw new Error('資料庫的 213 區對應不完整，已取消日期同步')
    const tuples = [...values].map(([no, date]) => Prisma.sql`(${no}::integer, ${date}::timestamp(3))`)
    const updated = await tx.$executeRaw(Prisma.sql`
      UPDATE "areas" AS a
      SET "lastReportedCompletedAt" = v.completed, "updatedAt" = CURRENT_TIMESTAMP
      FROM (VALUES ${Prisma.join(tuples)}) AS v(no, completed)
      WHERE a."sheetNo" = v.no AND a."lastReportedCompletedAt" IS DISTINCT FROM v.completed
    `)
    await tx.setting.upsert({
      where: { key: COMPLETION_SYNC_KEY },
      create: { key: COMPLETION_SYNC_KEY, value: now.toISOString() },
      update: { value: now.toISOString() },
    })
    return { updated, syncedAt: now.toISOString() }
  })
}
