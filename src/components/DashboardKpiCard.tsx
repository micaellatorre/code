import type { ReactNode } from 'react'

export interface DashboardKpiCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  trend?: number
  subtitle?: string
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

const toneMap: Record<NonNullable<DashboardKpiCardProps['tone']>, string> = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
}

export default function DashboardKpiCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  tone = 'default',
}: DashboardKpiCardProps) {
  const toneClass = toneMap[tone]

  return (
    <div className="rounded-2xl border border-base-content/10 bg-base-100 shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-base-content/60">{title}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>

            {subtitle ? (
              <div className="mt-2 text-xs text-base-content/50">{subtitle}</div>
            ) : null}

            {typeof trend === 'number' ? (
              <div className={`mt-3 text-xs font-medium ${trend >= 0 ? 'text-success' : 'text-error'}`}>
                {trend >= 0 ? '+' : ''}
                {trend.toFixed(1)}% vs. período anterior
              </div>
            ) : null}
          </div>

          {icon ? (
            <div className={`shrink-0 rounded-xl bg-base-200 p-3 ${toneClass}`}>
              {icon}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}