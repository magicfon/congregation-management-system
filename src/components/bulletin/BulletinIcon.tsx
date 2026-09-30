import { BookOpen, ClipboardList, MapPin, Megaphone, Mic, Users, CalendarDays } from 'lucide-react'
import type { BulletinCategory } from '@/lib/bulletin'

const icons = { talk: Mic, book: BookOpen, notice: Megaphone, people: Users, location: MapPin, service: CalendarDays, report: ClipboardList }

export default function BulletinIcon({ icon, className = 'h-6 w-6' }: { icon: BulletinCategory['icon']; className?: string }) {
  const Icon = icons[icon]
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className} />
}
