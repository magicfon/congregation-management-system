'use client'

import { useEffect } from 'react'
import { bulletinCategories } from '@/lib/bulletin'
import { loadPdfEngine, prefetchPdf } from './pdf-engine'

export default function ReaderWarmup() {
  useEffect(() => {
    void loadPdfEngine().catch(() => {})
    const warm = (event: Event) => {
      const anchor = (event.target as Element).closest('a')
      const category = bulletinCategories.find(item => anchor?.getAttribute('href') === `/bulletin/${item.slug}`)
      category?.sources.forEach(source => { if (source.pdf) prefetchPdf(source.pdf) })
    }
    document.addEventListener('pointerover', warm)
    document.addEventListener('focusin', warm)
    document.addEventListener('touchstart', warm, { passive: true })
    return () => {
      document.removeEventListener('pointerover', warm)
      document.removeEventListener('focusin', warm)
      document.removeEventListener('touchstart', warm)
    }
  }, [])
  return null
}
