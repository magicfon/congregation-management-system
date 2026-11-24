'use client'
import ReminderSettingsCard from './ReminderSettingsCard'

// 公眾演講週一提醒（ADR-0145）：管理員開關並指定收件人，每週一早上 LINE 私訊本週末講者
export default function PublicTalkReminder() {
  return <ReminderSettingsCard<{ week: string; queued: number; at: string }>
    endpoint="/api/admin/public-talk-reminder"
    title="公眾演講週一提醒"
    description="每週一早上 9 點起，LINE 私訊本週末的講題與講者給指定的人。"
    previewLabel="預覽本週提醒內容"
    emptyPreview="公眾演講秩序表上找不到本週的安排，這週不會發送。"
    lastRunText={run => `上次排程：${run.week} 那週，排入 ${run.queued} 則。`} />
}
