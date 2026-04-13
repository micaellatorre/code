import type { ReactNode } from "react"
import { Card } from "@tremor/react"

type DashboardSectionProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export default function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className = "",
}: DashboardSectionProps) {
  return (
    <Card className={`rounded-lg border border-base-content/10 bg-base-100 shadow-sm ${className}`}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-base-content">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-base-content/60">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 justify-start sm:justify-end">{action}</div> : null}
      </div>
      {children}
    </Card>
  )
}
