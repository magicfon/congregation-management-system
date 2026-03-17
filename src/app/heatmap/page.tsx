import { supabase } from '../lib/supabase-server'
import { Suspense } from 'react'

type AreaWithActivity = {
  id: string
  name: string
  lastactivityat: string | null
}

function getDaysSince(dateString: string | null): number | null {
  if (!dateString) return null
  
  const lastActivity = new Date(dateString)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - lastActivity.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

function getHeatColor(days: number | null): string {
  if (days === null) return 'bg-gray-700'
  if (days < 30) return 'bg-green-500'
  if (days < 90) return 'bg-yellow-500'
  if (days < 180) return 'bg-orange-500'
  return 'bg-red-500'
}

function getHeatLabel(days: number | null): string {
  if (days === null) return '無記錄'
  if (days < 30) return '活躍'
  if (days < 90) return '正常'
  if (days < 180) return '注意'
  return '閒置'
}

async function HeatmapContent() {
  const { data: areas, error } = await supabase
    .from('areas')
    .select('id, name, lastactivityat')
    .order('lastactivityat', { ascending: false, nullsFirst: false })

  if (error) {
    return (
      <div className="text-red-400 text-center py-10">
        錯誤：{error.message}
      </div>
    )
  }

  const areasWithDays = (areas || []).map(area => ({
    ...area,
    daysSince: getDaysSince(area.lastactivityat)
  }))

  // 統計
  const totalAreas = areasWithDays.length
  const activeAreas = areasWithDays.filter(a => (a.daysSince || 999) < 30).length
  const normalAreas = areasWithDays.filter(a => {
    const days = a.daysSince || 999
    return days >= 30 && days < 90
  }).length
  const attentionAreas = areasWithDays.filter(a => {
    const days = a.daysSince || 999
    return days >= 90 && days < 180
  }).length
  const idleAreas = areasWithDays.filter(a => (a.daysSince || 999) >= 180).length

  const avgDays = areasWithDays.reduce((sum, a) => sum + (a.daysSince || 0), 0) / totalAreas

  return (
    <>
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-mc-surface p-4 rounded-lg border border-white/5">
          <div className="text-2xl font-bold text-white">{totalAreas}</div>
          <div className="text-sm text-gray-400">總地區數</div>
        </div>
        <div className="bg-green-500/20 p-4 rounded-lg border border-green-500/30">
          <div className="text-2xl font-bold text-green-400">{activeAreas}</div>
          <div className="text-sm text-green-300">活躍（&lt;30天）</div>
        </div>
        <div className="bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/30">
          <div className="text-2xl font-bold text-yellow-400">{normalAreas}</div>
          <div className="text-sm text-yellow-300">正常（30-90天）</div>
        </div>
        <div className="bg-orange-500/20 p-4 rounded-lg border border-orange-500/30">
          <div className="text-2xl font-bold text-orange-400">{attentionAreas}</div>
          <div className="text-sm text-orange-300">注意（90-180天）</div>
        </div>
        <div className="bg-red-500/20 p-4 rounded-lg border border-red-500/30">
          <div className="text-2xl font-bold text-red-400">{idleAreas}</div>
          <div className="text-sm text-red-300">閒置（&gt;180天）</div>
        </div>
      </div>

      {/* 平均閒置天數 */}
      <div className="bg-mc-surface p-4 rounded-lg border border-white/5 mb-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">
            {avgDays.toFixed(0)} 天
          </div>
          <div className="text-sm text-gray-400">平均閒置時間</div>
        </div>
      </div>

      {/* 熱力圖 */}
      <div className="bg-mc-surface p-6 rounded-lg border border-white/5">
        <h2 className="text-xl font-semibold mb-4 text-white">地區閒置熱力圖</h2>
        
        {/* 圖例 */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-gray-300">活躍（&lt;30天）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-gray-300">正常（30-90天）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-gray-300">注意（90-180天）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-gray-300">閒置（&gt;180天）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-700"></div>
            <span className="text-gray-300">無記錄</span>
          </div>
        </div>

        {/* 網格 */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {areasWithDays.map(area => (
            <div
              key={area.id}
              className={`${getHeatColor(area.daysSince)} p-3 rounded text-center transition-transform hover:scale-105 cursor-pointer`}
              title={`地區 ${area.id}\n最後活動：${area.lastactivityat ? new Date(area.lastactivityat).toLocaleDateString('zh-TW') : '無記錄'}\n閒置：${area.daysSince || '?'} 天`}
            >
              <div className="text-xs font-bold text-white">{area.id}</div>
              <div className="text-xs text-white/80">{area.daysSince || '?'}天</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function HeatmapPage() {
  return (
    <div className="min-h-screen bg-mc-bg text-mc-text">
      <div className="container mx-auto px-4 py-8">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">地區閒置熱力圖</h1>
          <p className="text-gray-400">視覺化呈現各地區的活動狀態</p>
        </div>

        {/* 內容 */}
        <Suspense fallback={
          <div className="text-center py-20">
            <div className="text-4xl mb-4">⏳</div>
            <div className="text-gray-400">載入中...</div>
          </div>
        }>
          <HeatmapContent />
        </Suspense>
      </div>
    </div>
  )
}
