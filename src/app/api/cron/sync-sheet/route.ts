import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import {
  taipeiDate,
  readValues,
  readSnapshot,
  updateSnapshot,
  pushAreaCDBatch,
  DEFAULT_SHEET_ID,
} from '../../../../lib/google-sheets'
import { randomUUID } from 'crypto'
import { syncReportCompletions } from '../../../../lib/report-completion-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/sync-sheet — Vercel Cron 每 15 分鐘
 *
 * 三件事：
 * 1. Form 回報匯入：「傳道區域回報」時間戳記 > 上次同步點的新列
 *    → 該區域 completedAt = 該列結束日期（Q4=A：回報視同收回）
 *    → 姓名不在 Member → 自動建立
 * 2. Sheet C/D 手動編輯偵測（快照比對）：
 *    Sheet ≠ 快照 → Sheet 贏，匯入 DB（後寫的贏）
 * 3. 推送補救：DB isDispatched 但 Sheet C/D 落後 → 推回 Sheet
 *
 * Auth：Vercel Cron 自帶 Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Vercel Cron 會帶 CRON_SECRET；也允許 admin 手動觸發
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isCron) {
    const { requireApiUser } = await import('../../../../lib/api-auth')
    const auth = await requireApiUser(['admin'])
    if ('response' in auth) return auth.response
  }

  const result = { completionDatesUpdated: 0, imported: 0, sheetEdits: 0, conflicts: 0, pushedBack: 0, errors: [] as string[] }

  try {
    // ============ 1. Form 回報匯入 ============
    const lastSetting = await prisma.setting.findUnique({ where: { key: 'sheet_report_synced_at' } })
    // 上次同步到的時間戳記（字串格式同 Sheet：2026/8/14 下午 7:41:23）
    // 比較用：把 Sheet 時間戳記轉成可排序的 Date
    const lastTs = lastSetting ? new Date(lastSetting.value) : new Date(0)

    const reportRows = await readValues(DEFAULT_SHEET_ID, '傳道區域回報!A2:G')
    const areas = await prisma.area.findMany()
    const bySheetNo = new Map(areas.filter(a => a.sheetNo != null).map(a => [a.sheetNo!, a] as const))
    const memberCache = new Map((await prisma.member.findMany()).map(m => [m.name, m.id]))

    // Sheet 時間戳記 parse：'2026/8/14 下午 7:41:23' / '2026/8/14 上午 10:56:15'
    function parseTs(s: string): Date | null {
      const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)\s+(\d{1,2}):(\d{2}):(\d{2})/)
      if (!m) return null
      let h = +m[5]
      if (m[4] === '下午' && h < 12) h += 12
      if (m[4] === '上午' && h === 12) h = 0
      return new Date(+m[1], +m[2] - 1, +m[3], h, +m[6], +m[7])
    }
    function parseDate(s: string): Date | null {
      const m = s.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      if (m) return new Date(+m[1], +m[2] - 1, +m[3])
      const num = Number(s)
      if (!isNaN(num) && num > 40000) return new Date(Date.UTC(1899, 11, 30) + num * 86400000)
      return null
    }

    let maxTs: Date | null = null
    for (const row of reportRows) {
      const [tsCell, nameCell, , noCell, , endCell] = row
      const ts = parseTs((tsCell || '').toString())
      if (!ts || ts <= lastTs) continue
      const name = (nameCell || '').toString().trim()
      const sheetNo = Number(noCell)
      const area = bySheetNo.get(sheetNo)
      if (!area) {
        result.errors.push(`回報區域 #${sheetNo} 找不到（${name}）`)
        continue
      }

      // Q4=A：回報 = 收回。completedAt = 結束日期
      const completedAt = parseDate((endCell || '').toString()) || ts

      // 只處理「真的分發中」的（避免舊回報重複觸發）
      const isActive = area.assignedMemberId &&
        (!area.dispatchedAt || !area.completedAt || area.dispatchedAt >= area.completedAt)
      if (!isActive) continue

      await prisma.area.update({
        where: { id: area.id },
        data: { completedAt, lastActivityAt: new Date() },
      })
      result.imported++

      if (!memberCache.has(name)) {
        const nm = await prisma.member.create({
          data: { name, email: `sheet-${randomUUID().slice(0, 8)}@placeholder.local`, password: randomUUID() },
        })
        memberCache.set(name, nm.id)
      }

      if (!maxTs || ts > maxTs) maxTs = ts
    }

    if (maxTs) {
      await prisma.setting.upsert({
        where: { key: 'sheet_report_synced_at' },
        create: { key: 'sheet_report_synced_at', value: maxTs.toISOString() },
        update: { value: maxTs.toISOString() },
      })
    }

    // ============ 2+3. 快照比對 + 推送補救 ============
    const statusRows = await readValues(DEFAULT_SHEET_ID, '區域狀態!A2:E214')
    try {
      result.completionDatesUpdated = (await syncReportCompletions(prisma, statusRows)).updated
    } catch (error) {
      // A bad E-cell must not interrupt existing C/D assignment synchronization.
      console.error('Report completion date sync failed:', error)
      result.errors.push('最後回報日期同步失敗；保留原日期，請檢查 E 欄與 213 區完整性')
    }
    const snapshot = await readSnapshot()
    const freshAreas = await prisma.area.findMany({ include: { assignedMember: true } })
    const freshBySheetNo = new Map(freshAreas.filter(a => a.sheetNo != null).map(a => [a.sheetNo!, a] as const))

    const pushQueue: { sheetNo: number; memberName: string | null; dispatchedAt: Date | null }[] = []
    const snapUpdates: { sheetNo: number; member: string; date: Date | null; keepDate?: boolean }[] = []

    for (let i = 0; i < statusRows.length; i++) {
      const row = statusRows[i]
      const sheetNo = Number(row[1])
      if (!sheetNo) continue
      const area = freshBySheetNo.get(sheetNo)
      if (!area) continue

      const sheetMember = (row[2] || '').toString().trim()
      const sheetDateStr = (row[3] || '').toString().trim()
      const snap = snapshot.get(sheetNo)
      const snapMember = snap?.member || ''
      const snapDate = snap?.date || ''

      // normalize sheet date
      const sd = parseDate(sheetDateStr)
      const sheetDateNorm = sd ? sd.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : ''

      const sheetChanged = sheetMember !== snapMember || sheetDateNorm !== snapDate
      if (!sheetChanged) continue

      // Sheet 與快照不同 → 有人改了 Sheet
      // 判斷 DB 是否也變了（跟快照比）
      const dbMember = area.assignedMember?.name || ''
      const dbDate = taipeiDate(area.dispatchedAt)
      const dbChanged = dbMember !== snapMember || dbDate !== snapDate

      if (dbChanged) {
        // 兩邊都變 → 真衝突 → DB 贏（後寫的贏：DB 操作時間 > Sheet 手動編輯）
        // 推 DB 回 Sheet + 記錄
        result.conflicts++
        pushQueue.push({ sheetNo, memberName: dbMember || null, dispatchedAt: area.dispatchedAt })
        snapUpdates.push({ sheetNo, member: dbMember, date: area.dispatchedAt })
      } else {
        // 只有 Sheet 變 → Sheet 贏，匯入 DB
        let memberId: string | null | undefined = undefined
        if (sheetMember) {
          if (!memberCache.has(sheetMember)) {
            const nm = await prisma.member.create({
              data: {
                name: sheetMember,
                email: `sheet-${randomUUID().slice(0, 8)}@placeholder.local`,
                password: randomUUID(),
              },
            })
            memberCache.set(sheetMember, nm.id)
          }
          memberId = memberCache.get(sheetMember)
        }
        const dispatchedAt = sd
        await prisma.area.update({
          where: { id: area.id },
          data: {
            assignedMemberId: memberId ?? null,
            assignedTo: sheetMember || null,
            dispatchedAt: memberId ? dispatchedAt : area.dispatchedAt,
            completedAt: memberId ? null : area.completedAt,
            lastActivityAt: new Date(),
          },
        })
        result.sheetEdits++
        snapUpdates.push({ sheetNo, member: sheetMember, date: dispatchedAt })
      }
    }

    // ============ 推送補救：DB isDispatched 但 Sheet 是空的且快照也是空 → 可能漏推 ============
    // （上面迴圈已處理 sheetChanged 的情況；這裡補：DB 有值、Sheet 空、快照空 → 推）
    for (const area of freshAreas) {
      if (!area.sheetNo) continue
      const isActive = area.assignedMemberId &&
        (!area.dispatchedAt || !area.completedAt || area.dispatchedAt >= area.completedAt)
      if (!isActive) continue
      const snap = snapshot.get(area.sheetNo)
      const dbMember = area.assignedMember?.name || ''
      if (snap && snap.member === dbMember) continue // 快照已同步，OK
      const statusRow = statusRows.find(r => Number(r[1]) === area.sheetNo)
      if (statusRow && (statusRow[2] || '').toString().trim() === dbMember) continue // Sheet 已正確
      pushQueue.push({ sheetNo: area.sheetNo, memberName: dbMember, dispatchedAt: area.dispatchedAt })
      snapUpdates.push({ sheetNo: area.sheetNo, member: dbMember, date: area.dispatchedAt })
      result.pushedBack++
    }

    if (pushQueue.length > 0) {
      await pushAreaCDBatch(DEFAULT_SHEET_ID, pushQueue)
    }
    if (snapUpdates.length > 0) {
      await updateSnapshot(snapUpdates)
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('POST /api/cron/sync-sheet error:', error)
    return NextResponse.json(
      { ok: false, ...result, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
