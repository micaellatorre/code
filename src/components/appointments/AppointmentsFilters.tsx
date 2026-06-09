"use client"

import type { AppointmentStatusSegment } from "./types"

type AppointmentsFiltersProps = {
  statusSegment: AppointmentStatusSegment
  onStatusSegmentChange: (segment: AppointmentStatusSegment) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  total: number
  filtered: number
}

const segments: { value: AppointmentStatusSegment; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "sold", label: "Vendidas" },
]

export default function AppointmentsFilters({
  statusSegment,
  onStatusSegmentChange,
  searchQuery,
  onSearchQueryChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  total,
  filtered,
}: AppointmentsFiltersProps) {
  return (
    <div className="flex flex-col-reverse md:flex-col gap-3 rounded-lg bg-base-200 border border-base-300 p-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="join border border-base-400">
        {segments.map((segment) => (
          <button
            key={segment.value}
            type="button"
            className={`w-auto flex-1 btn join-item btn-sm ${statusSegment === segment.value ? "btn-primary" : "btn-ghost"}`}
            onClick={() => onStatusSegmentChange(segment.value)}
          >
            {segment.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar por equipo, cliente..."
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="input input-bordered input-sm min-w-64 flex-1"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="input input-bordered input-sm"
          aria-label="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="input input-bordered input-sm"
          aria-label="Hasta"
        />
      </div>
    </div>
  )
}
