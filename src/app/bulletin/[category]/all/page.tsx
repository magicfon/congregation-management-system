import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ServiceRosterOverview from '@/components/bulletin/ServiceRosterOverview'

export const metadata = { title: { absolute: '所有週次｜楠梓會眾公布欄' } }

export default function RosterOverviewPage({ params, searchParams }: { params: { category: string }; searchParams: { tab?: string } }) {
  if (params.category !== 'service-roster') notFound()
  return <DashboardLayout publicView>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">所有週次</h1>
      <Link href="/bulletin/service-roster" className="flex min-h-12 items-center rounded-lg border border-white/10 px-3 text-lg">返回本週</Link>
    </div>
    <ServiceRosterOverview initialTab={searchParams.tab === 'mine' ? 'mine' : 'microphones'} />
  </DashboardLayout>
}
