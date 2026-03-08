import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '會眾傳道區域管理系統',
  description: '追蹤和管理傳道區域、排班和統計',
}

export default function Root() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">會眾傳道區域管理系統</h1>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">總覽</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-blue-600">12</p>
                <p className="text-sm text-gray-500">總區域</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">8</p>
                <p className="text-sm text-gray-500">活躍區域</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">4</p>
                <p className="text-sm text-gray-500">閒置區域</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">0</p>
                <p className="text-sm text-gray-500">本週回報</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">區域列表</h2>
            <p className="text-gray-500">載入中...</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">排班系統</h2>
            <p className="text-gray-500">載入中...</p>
          </div>
        </div>
      </div>
    </main>
  )
}
