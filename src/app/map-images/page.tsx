'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MapImageInfo {
  id: string
  name: string
  range: string
  image: string
  thumb: string
  sizeLabel: string
}

const MAPS: MapImageInfo[] = [
  {
    id: 'nanzih',
    name: '楠梓區',
    range: 'A-1 ~ A-89',
    image: '/maps/nanzih-1-89.png',
    thumb: '/maps/thumbs/nanzih-1-89.webp',
    sizeLabel: '7884×5512 · 20MB',
  },
  {
    id: 'chiaotou',
    name: '橋頭區',
    range: 'B-90 ~ B-148',
    image: '/maps/chiaotou-90-148.png',
    thumb: '/maps/thumbs/chiaotou-90-148.webp',
    sizeLabel: '4827×4534 · 6.6MB',
  },
  {
    id: 'tzuguan',
    name: '梓官區',
    range: 'C-149 ~ C-213',
    image: '/maps/tzuguan-149-213.png',
    thumb: '/maps/thumbs/tzuguan-149-213.webp',
    sizeLabel: '4828×4038 · 4.7MB',
  },
]

export default function MapImagesPage() {
  const [preview, setPreview] = useState<MapImageInfo | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">地圖圖檔</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            查看與下載各區地圖原始圖檔
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {MAPS.map((m) => (
          <div key={m.id} className="mc-card rounded-xl overflow-hidden flex flex-col">
            <button
              type="button"
              className="block w-full text-left group"
              onClick={() => setPreview(m)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.thumb}
                alt={`${m.name}地圖`}
                className="w-full h-48 object-cover group-hover:opacity-80 transition-opacity"
              />
            </button>
            <div className="p-4 flex-1 flex flex-col gap-3">
              <div>
                <div className="font-semibold text-mc-text">{m.name}</div>
                <div className="text-xs text-mc-text-secondary mt-0.5">
                  {m.range} · {m.sizeLabel}
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setPreview(m)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-mc-accent/20 text-mc-highlight border border-mc-accent/40 hover:bg-mc-accent/30 transition-colors"
                >
                  查看
                </button>
                <a
                  href={m.image}
                  download
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-mc-accent text-white hover:bg-mc-highlight transition-colors text-center"
                >
                  下載
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 全螢幕預覽 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-w-6xl w-full mc-card rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <span className="font-semibold text-mc-text">{preview.name}</span>
                <span className="text-xs text-mc-text-secondary ml-2">
                  {preview.range} · {preview.sizeLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={preview.image}
                  download
                  className="px-3 py-1.5 text-sm rounded-lg bg-mc-accent text-white hover:bg-mc-highlight transition-colors"
                >
                  下載原圖
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-mc-text hover:bg-white/20 transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.image}
                alt={`${preview.name}地圖原圖`}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-mc-text-secondary">
        ※ 圖檔更新請通知管理員同步（目前版本：2026-05-03）
      </div>
    </div>
  )
}
