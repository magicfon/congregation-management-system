import DashboardLayout from '../../components/layout/DashboardLayout'
import { PUBLIC_BOUNDARY_EDITOR_ENABLED } from '../../lib/public-boundary-editor'

export const metadata = { title: '地圖編輯器' }

export default function PublicBoundaryEditorPage() {
  return <DashboardLayout publicView>
    <div className="mx-auto max-w-[1600px]">
      <a href="/map-images" className="mb-2 inline-flex min-h-11 items-center text-sm text-blue-300 underline underline-offset-4">返回地圖圖檔</a>
      {PUBLIC_BOUNDARY_EDITOR_ENABLED ? <iframe title="地圖編輯器（免登入）" src="/tools/boundary-editor/index.html?access=public" className="block h-[calc(100dvh-13rem)] min-h-80 w-full border-0 rounded-xl" /> : <p className="rounded-xl border border-white/10 bg-mc-card p-4 text-sm text-mc-text-secondary">地圖編輯暫停開放。需要修改地圖請聯絡管理員。</p>}
    </div>
  </DashboardLayout>
}
