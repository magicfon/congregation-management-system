import { redirect } from 'next/navigation'

// 傳道行程功能已移除（ADR-0116）；舊連結導回我的看板。
export default function SchedulesPage() {
  redirect('/dashboard')
}
