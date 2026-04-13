"use client"

import { Button } from "@tremor/react"
import type { DashboardProductTypeFilter } from "./DashboardTypes"

type DashboardProductTypeToggleProps = {
  value: DashboardProductTypeFilter
  onChange: (value: DashboardProductTypeFilter) => void
  compact?: boolean
}

const options: Array<{ value: DashboardProductTypeFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PHONE", label: "iPhones" },
  { value: "ACCESSORY", label: "Accesorios" },
]

export default function DashboardProductTypeToggle({
  value,
  onChange,
  compact = false,
}: DashboardProductTypeToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-base-content/10 bg-base-200/60 p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          size="xs"
          variant={value === option.value ? "primary" : "light"}
          onClick={() => onChange(option.value)}
          className={compact ? "px-2" : undefined}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
