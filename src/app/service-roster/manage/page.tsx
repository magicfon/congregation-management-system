import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ServiceRoster from '@/components/bulletin/ServiceRoster'
import NoPermission from '@/components/layout/NoPermission'

export const dynamic = 'force-dynamic'
export const metadata = { title: '管理服務安排｜楠梓會眾' }

export default async function ServiceRosterManagementPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) redirect('/login?callbackUrl=%2Fservice-roster%2Fmanage')
  if (user.role !== 'admin') return <NoPermission title="管理服務安排" publicHref="/bulletin/service-roster" publicLabel="查看服務安排" />

  return <DashboardLayout publicView>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">管理服務安排</h1>
      <Link href="/bulletin/service-roster" className="flex min-h-12 items-center rounded-lg border border-white/10 px-4 text-base">查看公開頁</Link>
    </div>
    <ServiceRoster management />
  </DashboardLayout>
}
