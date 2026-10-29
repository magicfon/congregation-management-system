import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Midweek from '@/components/bulletin/Midweek'
import Link from 'next/link'
import NoPermission from '@/components/layout/NoPermission'
export const dynamic = 'force-dynamic'
export const metadata = { title: '編排週中聚會｜楠梓會眾' }
export default async function Page() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) redirect('/login?callbackUrl=%2Fmidweek%2Fmanage')
  if (user.role !== 'admin') return <NoPermission title="編排週中聚會" publicHref="/bulletin/midweek-meeting" publicLabel="查看週中聚會節目" />
  return <DashboardLayout>
    <div className="mx-auto w-full max-w-7xl px-5 py-6 md:p-8 xl:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8"><h1 className="text-2xl font-semibold tracking-tight">編排週中聚會</h1><Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-sm hover:bg-mc-accent">我的看板</Link></div>
      <Midweek management />
    </div>
  </DashboardLayout>
}
