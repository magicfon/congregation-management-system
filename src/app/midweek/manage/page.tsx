import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Midweek from '@/components/bulletin/Midweek'
export const dynamic = 'force-dynamic'
export const metadata = { title: '編排週中聚會｜楠梓會眾' }
export default async function Page() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) redirect('/login?callbackUrl=%2Fmidweek%2Fmanage')
  if (user.role !== 'admin') redirect('/bulletin/midweek-meeting')
  return <DashboardLayout>
    <div className="mx-auto w-full max-w-7xl px-5 py-6 md:p-8 xl:p-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight md:mb-8">編排週中聚會</h1>
      <Midweek management />
    </div>
  </DashboardLayout>
}
