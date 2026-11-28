import assert from 'node:assert/strict'
import { adminTaskReminderText, adminTaskTotal } from '../src/lib/admin-task-reminder'

// 管理待辦提醒（ADR-0148 修訂）：只看四項，沒有待辦不發；只列有數字的項目
const zero = { line: 0, requests: 0, alerts: 0, doNotVisit: 0 }
assert.equal(adminTaskReminderText(zero, '2026-11-24'), null)
const text = adminTaskReminderText({ ...zero, line: 2, requests: 1 }, '2026-11-24')!
assert.equal(text, [
  '管理待辦提醒（11/24（二））', '',
  '・LINE 待確認 2 人', '・領圖待審 1 張', '',
  '請到我的看板處理：https://congregation-management-system.vercel.app/dashboard',
].join('\n'))
assert.equal(adminTaskTotal({ ...zero, alerts: 2, doNotVisit: 1 }), 3)
console.log('admin task reminder checks passed')
