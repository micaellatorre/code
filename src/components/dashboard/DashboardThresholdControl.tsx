"use client"

import { NumberInput } from "@tremor/react"

type DashboardThresholdControlProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

export default function DashboardThresholdControl({
  label,
  value,
  min = 0,
  max,
  step = 1,
  suffix,
  onChange,
}: DashboardThresholdControlProps) {
  function handleChange(nextValue: number) {
    if (Number.isNaN(nextValue)) return
    const clamped = Math.max(min, max == null ? nextValue : Math.min(max, nextValue))
    onChange(clamped)
  }

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-base-content/70">
      <span>{label}</span>
      <NumberInput
        className="w-24"
        min={min}
        max={max}
        step={step}
        value={value}
        enableStepper
        onValueChange={handleChange}
      />
      {suffix ? <span>{suffix}</span> : null}
    </label>
  )
}
