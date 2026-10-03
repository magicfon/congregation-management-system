import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ServiceRosterOverview from '@/components/bulletin/ServiceRosterOverview'

export const metadata = { title: '所有週次｜服務安排' }

export default function RosterOverviewPage({ params }: { params: { category: string } }) {
  if (params.category !== 'service-roster') notFound()
  return <DashboardLayout publicView>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">所有週次</h1>
      <Link href="/bulletin/service-roster" className="flex min-h-12 items-center rounded-lg border border-white/10 px-3 text-lg">返回本週</Link>
    </div>
    <ServiceRosterOverview />
  </DashboardLayout>
}
