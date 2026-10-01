import type { Prisma, PrismaClient } from '@prisma/client'
import { botSite } from './line-bot-client'
import { queueLineNotification, drainLineNotifications } from './line-notifications'

export async function queuePairingNotice(tx: Prisma.TransactionClient, member: { id: string; name: string }) {
  return queueLineNotification(tx, member.id,
    `已完成確認，您的 LINE 帳號已連結至「${member.name}」。\n可以查詢「我的地圖」「本週行程」「待交接」。\n\n請重新登入網站使用成員功能：\n${botSite}/login`, new Date())
}

export async function deliverPairingNotice(db: PrismaClient, id: string | null) {
  if (!id) return '未發送通知（通知未啟用或使用者已關閉）'
  try {
    const result = await drainLineNotifications(db, [id])
    if (result.accepted) return 'LINE 已接受配對完成通知'
    if (result.failed) return '配對已完成，通知發送失敗，請查看 LINE 通知狀態'
  } catch { /* The committed pairing is successful even if delivery is unavailable. */ }
  return '配對已完成，通知待重試'
}
