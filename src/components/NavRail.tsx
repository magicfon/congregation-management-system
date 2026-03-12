'use client'

import { useState } from 'react'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  id: string
  label?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'core',
    items: [
      { id: 'overview', label: '總覽', icon: <OverviewIcon /> },
      { id: 'territories', label: '地區', icon: <TerritoriesIcon /> },
      { id: 'schedules', label: '排程', icon: <SchedulesIcon /> },
      { id: 'reports', label: '報告', icon: <ReportsIcon /> },
    ],
  },
  {
    id: 'admin',
    label: '管理',
    items: [
      { id: 'people', label: '人員', icon: <PeopleIcon /> },
      { id: 'settings', label: '設定', icon: <SettingsIcon /> },
    ],
  },
]

interface NavRailProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function NavRail({ activeTab, onTabChange }: NavRailProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <>
      {/* Desktop Sidebar */}
      <nav
        className={`hidden md:flex flex-col bg-card border-r border-border shrink-0 transition-all duration-200 ease-in-out ${
          expanded ? 'w-[220px]' : 'w-14'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center shrink-0 ${expanded ? 'px-3 py-3 gap-2.5' : 'flex-col py-3 gap-2'}`}>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xs">CMS</span>
          </div>
          {expanded && (
            <span className="text-sm font-semibold text-foreground truncate flex-1">會眾管理</span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? '收起側邊欄' : '展開側邊欄'}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              {expanded ? (
                <polyline points="10,3 5,8 10,13" />
              ) : (
                <polyline points="6,3 11,8 6,13" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav Groups */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {navGroups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 && (
                <div className={`my-1.5 border-t border-border ${expanded ? 'mx-3' : 'mx-2'}`} />
              )}

              {expanded && group.label && (
                <div className="px-3 mt-3 mb-1">
                  <span className="text-[10px] tracking-wider text-muted-foreground/60 font-semibold select-none">
                    {group.label}
                  </span>
                </div>
              )}

              <div className={`flex flex-col ${expanded ? 'gap-0.5 px-2' : 'items-center gap-1'}`}>
                {group.items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={activeTab === item.id}
                    expanded={expanded}
                    onClick={() => onTabChange(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Status indicator */}
        <div className={`shrink-0 py-3 flex ${expanded ? 'px-3 items-center gap-2' : 'flex-col items-center'}`}>
          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-500 animate-pulse-dot" />
          {expanded && (
            <span className="text-xs text-muted-foreground truncate">系統正常</span>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <MobileBottomBar activeTab={activeTab} onTabChange={onTabChange} />
    </>
  )
}

function NavButton({ item, active, expanded, onClick }: {
  item: NavItem
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  if (expanded) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all relative ${
          active
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        }`}
      >
        {active && (
          <span className="absolute left-0 w-0.5 h-5 bg-primary rounded-r" />
        )}
        <div className="w-5 h-5 shrink-0">{item.icon}</div>
        <span className="text-sm truncate">{item.label}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      title={item.label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      <div className="w-5 h-5">{item.icon}</div>
      <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium bg-popover text-popover-foreground border border-border rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
        {item.label}
      </span>
      {active && (
        <span className="absolute left-0 w-0.5 h-5 bg-primary rounded-r" />
      )}
    </button>
  )
}

function MobileBottomBar({ activeTab, onTabChange }: {
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  const priorityItems = navGroups[0].items

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around px-1 h-14">
        {priorityItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg transition-all min-w-[48px] min-h-[48px] ${
              activeTab === item.id
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <div className="w-5 h-5">{item.icon}</div>
            <span className="text-[10px] font-medium truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

// SVG Icons
function OverviewIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function TerritoriesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v10H2z" />
      <path d="M2 6h12M6 6v7M10 6v7" />
    </svg>
  )
}

function SchedulesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4v4l2.5 2.5" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <path d="M5 5h6M5 8h6M5 11h3" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M14.5 14c0-2-1.5-3.5-3-3.5" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4" />
    </svg>
  )
}
