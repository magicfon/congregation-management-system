import { Prisma, PrismaClient } from '@prisma/client'
import { queueLineNotification } from './line-notifications'
import { botSite } from './line-bot-client'
import { isAreaDispatched, allocationLabel } from './allocation'
export type Stroke = { points: [number, number][]; width: number }
export type MinistryActor = { id: string; isAdmin: boolean }
export class MinistryError extends Error { constructor(message: string, public status = 409) { super(message) } }
export function ministryCycle(area: { assignedMemberId: string | null; dispatchedAt: Date | null }) { return `${area.assignedMemberId || 'none'}:${area.dispatchedAt?.toISOString() || 'legacy'}` }
export function validateStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value) || value.length > 200) throw new MinistryError('最多 200 筆筆跡', 400)
  let count = 0
  for (const stroke of value) {
    if (!stroke || typeof stroke.width !== 'number' || !Number.isFinite(stroke.width) || stroke.width < .002 || stroke.width > .08 || !Array.isArray(stroke.points) || !stroke.points.length) throw new MinistryError('筆跡格式無效', 400)
    count += stroke.points.length
    if (count > 12000 || stroke.points.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || p.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1))) throw new MinistryError('筆跡過多或座標超出地圖', 400)
  }
  return value.map(s => ({ width: s.width, points: s.points.map((p: [number, number]) => [p[0], p[1]]) }))
}
export function validMinistryDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value }
export type MinistryCommand = { action: 'plan' | 'reschedule' | 'start' | 'cancel' | 'save' | 'submit' | 'finish'; cycleKey: string; expectedRevision: number; visitId?: string; publisherId?: string; scheduledDate?: string; strokes?: unknown; note?: string }
export async function changeMinistry(db: PrismaClient, areaId: string, actor: MinistryActor, command: MinistryCommand, now = new Date()) {
  return db.$transaction(async tx => {
    const account = await tx.member.findUnique({ where: { id: actor.id }, select: { active: true } })
    if (!account?.active) throw new MinistryError('帳號未啟用', 403)
    const area = await tx.area.findUnique({ where: { id: areaId } })
    if (!area || !isAreaDispatched(area) || ministryCycle(area) !== command.cycleKey) throw new MinistryError('地圖已交回或重新分發，請重新載入')
    const manager = actor.isAdmin || area.assignedMemberId === actor.id
    const ownProgress = command.action === 'save' || command.action === 'submit'
    if (!ownProgress && !manager) throw new MinistryError('只有地圖管理者可以安排、交接或交回', 403)
    if (area.ministryRevision !== command.expectedRevision) throw new MinistryError('其他裝置已更新，請先保留筆跡並重新載入')
    const cycle = { areaId, cycleKey: command.cycleKey }
    const visit = command.visitId ? await tx.ministryVisit.findFirst({ where: { ...cycle, id: command.visitId } }) : null
    if (ownProgress && (!visit || visit.publisherId !== actor.id || visit.status !== 'active')) throw new MinistryError('只有目前被指派的傳道者能提交進度', 403)
    if (['start','cancel','reschedule'].includes(command.action) && !visit) throw new MinistryError('排程不存在')
    if (command.action === 'plan' || command.action === 'reschedule') {
      if (command.action === 'reschedule' && visit!.status !== 'planned') throw new MinistryError('只能修改尚未開始的預排')
      if (!validMinistryDate(command.scheduledDate) || !command.publisherId) throw new MinistryError('請選擇日期與傳道者', 400)
      const publisher = await tx.member.findUnique({ where: { id: command.publisherId }, select: { id: true, name: true, active: true } })
      if (!publisher?.active) throw new MinistryError('傳道者不存在或已停用', 400)
      const duplicate = await tx.ministryVisit.findFirst({ where: { ...cycle, ...(command.action === 'reschedule' ? { id: { not: visit!.id } } : {}), publisherId: publisher.id, scheduledDate: command.scheduledDate, status: { in: ['planned','active'] } } })
      if (duplicate) throw new MinistryError('此日期已安排這位傳道者')
      if (command.action === 'reschedule') await tx.ministryVisit.update({ where: { id: visit!.id }, data: { publisherId: publisher.id, publisherName: publisher.name, scheduledDate: command.scheduledDate } })
      else await tx.ministryVisit.create({ data: { ...cycle, managerId: area.assignedMemberId!, publisherId: publisher.id, publisherName: publisher.name, scheduledDate: command.scheduledDate } })
    } else if (command.action === 'start') {
      if (visit!.status !== 'planned') throw new MinistryError('只能交接尚未開始的安排')
      if (await tx.ministryVisit.findFirst({ where: { ...cycle, status: 'active' } })) throw new MinistryError('目前仍有人進行中，請先提交進度或取消該次安排')
      const publisher = await tx.member.findUnique({ where: { id: visit!.publisherId }, select: { active: true } })
      if (!publisher?.active) throw new MinistryError('傳道者帳號已停用')
      await tx.ministryVisit.update({ where: { id: visit!.id }, data: { status: 'active', startedAt: now } })
    } else if (command.action === 'cancel') {
      if (!['planned','active'].includes(visit!.status)) throw new MinistryError('已提交的紀錄不可取消')
      await tx.ministryVisit.update({ where: { id: visit!.id }, data: { status: 'cancelled' } })
    } else if (ownProgress) {
      const strokes = validateStrokes(command.strokes)
      if (typeof command.note !== 'string' || command.note.length > 2000) throw new MinistryError('備註最多 2000 字', 400)
      if (command.action === 'submit' && !strokes.length && !command.note.trim()) throw new MinistryError('請塗畫完成範圍或填寫本次進度', 400)
      await tx.ministryVisit.update({ where: { id: visit!.id }, data: { strokes: strokes as unknown as Prisma.InputJsonValue, note: command.note.trim(), ...(command.action === 'submit' ? { status: 'submitted', submittedAt: now } : {}) } })
    } else if (command.action === 'finish') {
      if (await tx.ministryVisit.findFirst({ where: { ...cycle, status: 'active' } })) throw new MinistryError('仍有進行中的傳道安排，請先提交進度或取消')
      await tx.ministryVisit.updateMany({ where: { ...cycle, status: 'planned' }, data: { status: 'cancelled' } })
      await tx.area.update({ where: { id: areaId }, data: { completedAt: now, lastActivityAt: now } })
      await tx.report.create({ data: { areaId, memberId: actor.id, content: '地圖管理者已確認整張完成並交回。', status: 'approved', reviewedBy: actor.id, reviewedAt: now } })
    } else throw new MinistryError('未知操作', 400)
    const updated = await tx.area.updateMany({ where: { id: areaId, ministryRevision: command.expectedRevision }, data: { ministryRevision: { increment: 1 } } })
    if (updated.count !== 1) throw new MinistryError('狀態同時被更新，請重新載入')
    const notificationIds: string[] = []
    const label = allocationLabel(area)
    const notify = async (memberId: string, text: string) => {
      const id = await queueLineNotification(tx, memberId, `${text}\n請開啟網站確認最新安排：\n${botSite}/dashboard`, now)
      if (id) notificationIds.push(id)
    }
    if (command.action === 'plan' || command.action === 'reschedule') {
      await notify(command.publisherId!, `${command.action === 'plan' ? '新增傳道預排' : '傳道預排已更新'}：${label}\n日期：${command.scheduledDate}\n尚待地圖管理者正式交接。`)
      if (command.action === 'reschedule' && visit!.publisherId !== command.publisherId) await notify(visit!.publisherId, `您的 ${label} 原預排已改派其他人員。`)
    } else if (command.action === 'start') await notify(visit!.publisherId, `已交接給您：${label}\n預排日期：${visit!.scheduledDate}\n可進入地圖查看交接摘要、塗畫並提交局部進度。`)
    else if (command.action === 'cancel') await notify(visit!.publisherId, `您的傳道安排已取消：${label}\n原日期：${visit!.scheduledDate}`)
    else if (command.action === 'submit') await notify(area.assignedMemberId!, `${label} 收到 ${visit!.publisherName} 的局部進度，請查看交接摘要並安排下一位。`)
    return { revision: area.ministryRevision + 1, sheetNo: area.sheetNo, notificationIds }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
