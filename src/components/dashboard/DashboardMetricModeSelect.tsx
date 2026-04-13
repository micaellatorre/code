"use client"

import { Select, SelectItem } from "@tremor/react"
import type { DashboardProductMetricMode } from "./DashboardTypes"

type DashboardMetricModeSelectProps = {
  value: DashboardProductMetricMode
  onChange: (value: DashboardProductMetricMode) => void
}

export default function DashboardMetricModeSelect({ value, onChange }: DashboardMetricModeSelectProps) {
  return (
    <Select
      className="w-40"
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as DashboardProductMetricMode)}
    >
      <SelectItem value="units">Unidades</SelectItem>
      <SelectItem value="profit">Utilidad</SelectItem>
    </Select>
  )
}
