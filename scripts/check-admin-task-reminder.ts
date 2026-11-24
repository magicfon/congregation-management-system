import assert from 'node:assert/strict'
import { adminTaskReminderText, adminTaskTotal } from '../src/lib/admin-task-reminder'

// 管理待辦每日提醒（ADR-0148）：沒有待辦不發；只列有數字的項目；學生通知單讀不到時略過
const zero = { line: 0, requests: 0, alerts: 0, doNotVisit: 0, noticesUnconfirmed: 0, noticesHandoff: 0, noticesPending: 0 }
assert.equal(adminTaskReminderText(zero, '2026-11-24'), null)
assert.equal(adminTaskReminderText({ ...zero, noticesUnconfirmed: null, noticesHandoff: null, noticesPending: null }, '2026-11-24'), null)
const text = adminTaskReminderText({ ...zero, line: 2, requests: 1, noticesUnconfirmed: 3, noticesPending: null }, '2026-11-24')!
assert.equal(text, [
  '管理待辦提醒（11/24（二））', '',
  '・LINE 待連結成員 2 人', '・領圖申請待審 1 張', '・學生通知單已發送未確認 3 人', '',
  '請到我的看板處理：https://congregation-management-system.vercel.app/dashboard',
].join('\n'))
assert.equal(adminTaskTotal({ ...zero, alerts: 2, noticesHandoff: 1, noticesPending: null }), 3)
console.log('admin task reminder checks passed')
