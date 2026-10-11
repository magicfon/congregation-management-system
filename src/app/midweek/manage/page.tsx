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
  return <DashboardLayout><h1 className="mb-5 text-2xl font-semibold">編排週中聚會</h1><Midweek management /></DashboardLayout>
}
