import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authOptions } from '../../../lib/auth'

export default async function BoundaryEditorPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/map/boundary-editor')
  if ((session.user as { role?: string }).role !== 'admin') {
    return <DashboardLayout><p>分區修正僅供管理員使用。</p></DashboardLayout>
  }
  return <DashboardLayout>
    <div className="max-w-[1600px] mx-auto">
      <iframe title="地圖分區修正" src="/tools/boundary-editor/index.html" className="w-full h-[calc(100dvh-7rem)] min-h-[620px] border-0 rounded-xl" />
    </div>
  </DashboardLayout>
}
