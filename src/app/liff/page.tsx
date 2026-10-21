import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import LiffEntry from './LiffEntry'
import { authOptions } from '../../lib/auth'
import { configuredLiffId, liffEntryDestination } from '../../lib/liff-settings'

export const dynamic = 'force-dynamic'
export default async function LiffPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const destination = liffEntryDestination(searchParams)
  if (destination === '/bulletin') redirect(destination)

  // The server rechecks active membership and LINE binding before redirecting.
  // This device's session is authoritative; switching LINE accounts requires logout.
  const session = await getServerSession(authOptions)
  if ((session?.user as { id?: string } | undefined)?.id) redirect(destination)

  return <DashboardLayout entryView><LiffEntry liffId={configuredLiffId()} /></DashboardLayout>
}
