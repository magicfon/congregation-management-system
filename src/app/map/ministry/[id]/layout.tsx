import { redirect } from 'next/navigation'

// 地圖交接已關閉（ADR-0120）：舊連結與 LINE 通知裡的網址導回我的看板，資料保留不刪。
export default function Layout() {
  redirect('/dashboard?view=maps')
}
