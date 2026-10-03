import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ServiceRoster from '@/components/bulletin/ServiceRoster'

export const dynamic = 'force-dynamic'
export const metadata = { title: '管理服務安排｜楠梓會眾' }

export default async function ServiceRosterManagementPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) redirect('/login?callbackUrl=%2Fservice-roster%2Fmanage')
  if (user.role !== 'admin') redirect('/bulletin/service-roster')

  return <DashboardLayout publicView>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">管理服務安排</h1>
      <Link href="/bulletin/service-roster" className="flex min-h-12 items-center rounded-lg border border-white/10 px-4 text-base">查看公開頁</Link>
    </div>
    <ServiceRoster management />
  </DashboardLayout>
}
