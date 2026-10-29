// 學生練習通知單的純文字工具，前後端共用（ADR-0090）。
const weekday = ['日', '一', '二', '三', '四', '五', '六']
export const displayDate = (date: string) => `${Number(date.slice(0, 4))}/${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（週${weekday[new Date(`${date}T12:00:00Z`).getUTCDay()]}）`

// 無法用 LINE 發送時，管理員複製這段文字自行轉交。
export function studentNoticeText(notice: { name: string; assistant: string; date: string; title: string }) {
  return `傳道與生活聚會學生練習通知\n姓名：${notice.name}\n助手：${notice.assistant || '—'}\n日期：${displayDate(notice.date)}\n節目：${notice.title}\n受訓班別：第一班\n\n學生注意：《傳道與生活聚會手冊》裡提供了學生練習的資料來源和學習要點。請查看《傳道與生活聚會指示》（S-38）中關於學生練習的指示。`
}
