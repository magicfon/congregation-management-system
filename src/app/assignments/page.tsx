'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import MemberAssignments from '@/components/assignments/MemberAssignments'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function AssignmentsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setIsAdmin(data.isAdmin)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
          <div className="text-mc-text/40 py-20 text-center">載入中…</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-mc-text mb-1">人員分配總覽</h1>
        <p className="text-mc-text/40 text-sm mb-6">
          查看每位成員手上分發中的地圖
          {isAdmin ? ' · 可勾選收回' : ''}
        </p>
        <MemberAssignments isAdmin={isAdmin} />
      </div>
    </DashboardLayout>
  )
}
