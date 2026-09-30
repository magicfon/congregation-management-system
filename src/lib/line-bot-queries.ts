import type { PrismaClient } from '@prisma/client'
import { allocationLabel, isAreaDispatched } from './allocation'
import { ministryCycle } from './ministry'
import { ministryWeek } from './ministry-week'
import { taipeiDate } from './google-sheets'
import { botSite } from './line-bot-client'

export async function lineBotAnswer(db: PrismaClient, uid: string, command: string, now = new Date()) {
  const member = await db.member.findUnique({ where: { lineuid: uid }, select: { id: true, active: true } })
  if (!member?.active) return `請先使用 LINE 登入網站，並請管理員完成成員配對。\n${botSite}/login`
  const footer = `\n\n開啟網站查看詳情：\n${botSite}/dashboard`
  if (command === '本週行程') {
    const rows = await db.ministryVisit.findMany({ where: { publisherId: member.id, status: { in: ['planned','active'] } }, include: { area: true }, orderBy: { scheduledDate: 'asc' } })
    const tasks = rows.filter(v=>isAreaDispatched(v.area)&&v.cycleKey===ministryCycle(v.area)).map(v=>({ id:v.id,areaId:v.areaId,label:allocationLabel(v.area),date:v.scheduledDate,status:v.status }))
    const week = ministryWeek(taipeiDate(now), tasks)
    const entries = week.days.flatMap(d=>d.tasks)
    const lines = entries.slice(0,15).map(t=>`${t.date}｜${t.label}｜${t.status==='active'?'進行中':'待交接'}`)
    return `本週行程 ${week.days[0].date} ～ ${week.days[6].date}\n${lines.join('\n')||'本週沒有安排'}${entries.length>15?'\n其餘安排請至網站查看。':''}${week.earlier.length?`\n另有 ${week.earlier.length} 筆先前尚未完成。`:''}${footer}`
  }
  if (command === '我的地圖' || command === '待交接') {
    const areas = await db.area.findMany({ where: { assignedMemberId: member.id }, include: { ministryVisits: { select: { status: true, cycleKey: true } } }, orderBy: { sheetNo: 'asc' } })
    const maps = areas.filter(isAreaDispatched).filter(a=>command==='我的地圖'||(a.ministryVisits.some(v=>v.cycleKey===ministryCycle(a)&&v.status==='submitted')&&!a.ministryVisits.some(v=>v.cycleKey===ministryCycle(a)&&v.status==='active')))
    return `${command} · ${maps.length} 張\n${maps.slice(0,20).map(allocationLabel).join('\n')||'目前沒有地圖'}${maps.length>20?'\n更多地圖請至網站查看。':''}${footer}`
  }
  return `地圖分配系統\n請點下方「我的地圖」「本週行程」或「待交接」。\n查看交接摘要、塗畫、預排與回報請開啟網站。${footer}`
}
