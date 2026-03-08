'use client'

import { useState, useEffect } from 'react'

interface AddReportFormProps {
  onSuccess: () => void
  onCancel: () => void
}

interface Territory {
  id: number
  code: string
}

export default function AddReportForm({ onSuccess, onCancel }: AddReportFormProps) {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [formData, setFormData] = useState({
    publisher_name: '',
    time_slot: '',
    territory_id: '',
    start_date: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTerritories()
  }, [])

  async function fetchTerritories() {
    try {
      const res = await fetch('/api/territories')
      const data = await res.json()
      setTerritories(data.territories || [])
    } catch (err) {
      console.error('Failed to fetch territories:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          territory_id: formData.territory_id ? parseInt(formData.territory_id) : null
        })
      })

      if (!res.ok) throw new Error('Failed to create report')

      onSuccess()
    } catch (err) {
      setError('新增失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">📝 新增回報</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              傳道員姓名 *
            </label>
            <input
              type="text"
              required
              value={formData.publisher_name}
              onChange={(e) => setFormData({ ...formData, publisher_name: e.target.value })}
              placeholder="姓名"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              傳道時段
            </label>
            <select
              value={formData.time_slot}
              onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">選擇時段</option>
              <option value="週六上午">週六上午</option>
              <option value="週六下午">週六下午</option>
              <option value="週日上午">週日上午</option>
              <option value="週日下午">週日下午</option>
              <option value="其他">其他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              區域
            </label>
            <select
              value={formData.territory_id}
              onChange={(e) => setFormData({ ...formData, territory_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">選擇區域</option>
              {territories.map(t => (
                <option key={t.id} value={t.id}>{t.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日期
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備註
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="其他備註..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {loading ? '新增中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
