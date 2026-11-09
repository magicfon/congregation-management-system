import type { PrismaClient } from '@prisma/client'
import { allocationLabel, isAreaDispatched } from './allocation'
import { botSite, lineDisplayName } from './line-bot-client'
import { pendingLineMessage, recordPendingLineIdentity } from './pending-line-identities'

import { personalAssignments, assignmentsText } from './personal-assignments'

export async function lineBotAnswer(db: PrismaClient, uid: string, command: string, now = new Date()) {
  const member = await db.member.findUnique({ where: { lineuid: uid }, select: { id: true, active: true } })
  if (!member) {
    const pending = await db.pendingLineIdentity.findUnique({ where: { uid }, select: { displayName: true } })
    await recordPendingLineIdentity(db, uid, pending?.displayName || await lineDisplayName(uid))
    return `${pendingLineMessage}\n連結完成後，請再次傳送「我的地圖」。`
  }
  if (!member.active) return '此成員帳號已停用，請聯絡管理員確認權限。'
  const footer = `\n\n開啟網站查看詳情：\n${botSite}/dashboard`
  if (command === '我的委派') return assignmentsText(await personalAssignments(db, member.id, now), `${botSite}/dashboard?view=assignments`)
  if (command === '我的地圖') {
    const areas = await db.area.findMany({ where: { assignedMemberId: member.id }, orderBy: { sheetNo: 'asc' } })
    const maps = areas.filter(isAreaDispatched)
    return `${command} · ${maps.length} 張\n${maps.slice(0,20).map(allocationLabel).join('\n')||'目前沒有地圖'}${maps.length>20?'\n更多地圖請至網站查看。':''}${footer}`
  }
  return `地圖分配系統\n請點下方「我的委派」或「我的地圖」。${footer}`
}
