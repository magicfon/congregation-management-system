import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authOptions } from '../../../lib/auth'
import NoPermission from '../../../components/layout/NoPermission'

export default async function BoundaryEditorPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/map/boundary-editor')
  if ((session.user as { role?: string }).role !== 'admin') return <NoPermission title="分區修正" />
  return <DashboardLayout>
    <div className="max-w-[1600px] mx-auto p-4 md:p-8">
      <iframe title="地圖分區修正" src="/tools/boundary-editor/index.html" className="block w-full h-[calc(100dvh-8rem)] min-h-80 border-0 rounded-xl" />
    </div>
  </DashboardLayout>
}
