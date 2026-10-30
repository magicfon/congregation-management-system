import { redirect } from 'next/navigation'

// 舊「回報系統」不寫 Sheet、也沒有防呆；傳道回報統一用公布欄的區域回報（ADR-0102）
export default function ReportsPage() {
  redirect('/bulletin/territory-report')
}
