import DashboardLayout from '../../components/layout/DashboardLayout'

export default function PublicBoundaryEditorPage() {
  return <DashboardLayout>
    <div className="max-w-[1600px] mx-auto">
      <iframe title="地圖編輯器（免登入）" src="/tools/boundary-editor/index.html?access=public" className="w-full h-[calc(100dvh-7rem)] min-h-[620px] border-0 rounded-xl" />
    </div>
  </DashboardLayout>
}
