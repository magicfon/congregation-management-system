'use client'
import ReminderSettingsCard from './ReminderSettingsCard'
import type { AdminTaskReminderRun } from '@/lib/admin-task-reminder'

// 管理待辦每日提醒（ADR-0148）：有待辦時每天晚上 LINE 私訊一則彙整給指定的人
export default function AdminTaskReminder() {
  return <ReminderSettingsCard<AdminTaskReminderRun>
    endpoint="/api/admin/admin-task-reminder"
    title="管理待辦每日提醒"
    description="每天晚上 8 點起，若管理待辦或學生通知單還有待處理的項目，LINE 私訊一則彙整給指定的人；沒有待辦就不發。"
    previewLabel="預覽目前會發的內容"
    emptyPreview="目前沒有待辦，今天不會發送。"
    lastRunText={run => `上次排程：${run.date}，待辦 ${run.tasks} 項，排入 ${run.queued} 則。`} />
}
