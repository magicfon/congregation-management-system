'use client'

export const dynamic = 'force-dynamic'

import DashboardLayout from '../../components/layout/DashboardLayout'
import MapAllocationList from '../../components/map/MapAllocationList'

export default function MapPage() {
  return (
    <DashboardLayout>
      <div className="w-full max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl md:text-2xl font-bold text-mc-text">地圖分配</h1>
          <p className="text-mc-text/50 text-sm mt-1">依區域順序查看上次回報完成至今的天數，勾選可分發地圖後一次分發。</p>
        </div>

        <MapAllocationList />
      </div>
    </DashboardLayout>
  )
}
