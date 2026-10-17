import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PersonalAssignmentsPanel from '@/components/dashboard/PersonalAssignments'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { personalAssignments } from '@/lib/personal-assignments'

export const dynamic = 'force-dynamic'

export default async function AssignmentsPage({ params }: { params: { kind: string } }) {
  if (params.kind !== 'service' && params.kind !== 'program') notFound()
  const auth = await requireApiUser()
  if ('response' in auth) redirect('/login')
  const data = await personalAssignments(prisma, auth.user.id!)
  if (!data.showBrotherService && params.kind === 'service') redirect('/dashboard/assignments/program')
  return <DashboardLayout><div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8 text-mc-text">
    <Link href="/dashboard" className="inline-block py-2 text-sm text-mc-text/60">← 我的看板</Link>
    <h1 className="text-xl font-semibold">{!data.showBrotherService ? '我的委派' : params.kind === 'service' ? '弟兄服務' : '節目委派'}</h1>
    <PersonalAssignmentsPanel data={data} kind={params.kind} />
  </div></DashboardLayout>
}
