import { notFound, redirect } from 'next/navigation'

export default function AssignmentsPage({ params }: { params: { kind: string } }) {
  if (params.kind !== 'service' && params.kind !== 'program') notFound()
  redirect(`/dashboard?view=assignments&kind=${params.kind}`)
}
