'use client'

interface MetricCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick?: () => void
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  subtitle, 
  trend, 
  color = 'default',
  onClick 
}: MetricCardProps) {
  const colorClasses = {
    default: 'bg-card border-border hover:border-primary/30',
    success: 'bg-green-500/10 border-green-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    danger: 'bg-red-500/10 border-red-500/30',
    info: 'bg-blue-500/10 border-blue-500/30'
  }

  const iconColorClasses = {
    default: 'text-primary',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    info: 'text-blue-400'
  }

  return (
    <div 
      className={`p-6 rounded-lg border transition-all ${
        colorClasses[color]
      } ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <span className={`text-sm ${
                trend === 'up' ? 'text-green-400' : 
                trend === 'down' ? 'text-red-400' : 
                'text-muted-foreground'
              }`}>
                {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`text-2xl ${iconColorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

interface MetricGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  )
}
