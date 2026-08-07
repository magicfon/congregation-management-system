'use client'

export const dynamic = 'force-dynamic'

import DashboardLayout from '../../components/layout/DashboardLayout'
import TerritoryAssignment from '../../components/map/TerritoryAssignment'

export default function MapPage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-mc-text">地圖分配</h1>
          <p className="text-mc-text/50 text-sm mt-1">在地圖上直接分配區域負責人</p>
        </div>

        <TerritoryAssignment />
      </div>
    </DashboardLayout>
  )
}
