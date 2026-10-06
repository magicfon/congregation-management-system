import DashboardLayout from '../../components/layout/DashboardLayout'
import LiffEntry from './LiffEntry'
import { configuredLiffId } from '../../lib/liff-settings'

export const dynamic = 'force-dynamic'
export default function LiffPage() {
  return <DashboardLayout publicView><LiffEntry liffId={configuredLiffId()} /></DashboardLayout>
}
