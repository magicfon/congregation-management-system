import DashboardLayout from '../../components/layout/DashboardLayout'

export default function PublicBoundaryEditorPage() {
  return <DashboardLayout publicView>
    <div className="mx-auto max-w-[1600px]">
      <a href="/map-images" className="mb-2 inline-flex min-h-11 items-center text-sm text-blue-300 underline underline-offset-4">返回地圖圖檔</a>
      <iframe title="地圖編輯器（免登入）" src="/tools/boundary-editor/index.html?access=public" className="block h-[calc(100dvh-13rem)] min-h-80 w-full border-0 rounded-xl" />
    </div>
  </DashboardLayout>
}
