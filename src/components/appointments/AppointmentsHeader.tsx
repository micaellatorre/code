"use client"

import { PlusIcon } from "@heroicons/react/24/solid"
import Link from "next/link"

type AppointmentsHeaderProps = {
  selectedCalendarDate: string
  onSelectedCalendarDateChange: (value: string) => void
  onExport: () => void
}

export default function AppointmentsHeader({
  selectedCalendarDate,
  onSelectedCalendarDateChange,
  onExport,
}: AppointmentsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Reservas / Citas</h1>
        <p className="mt-1 text-sm text-base-content/60">
          Reuniones programadas con clientes y equipos fisicos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={selectedCalendarDate}
          onChange={(event) => onSelectedCalendarDateChange(event.target.value)}
          className="input input-bordered input-sm"
          aria-label="Fecha de calendario"
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={onExport}>
          Exportar lista
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
            <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
            <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
          </svg>
        </button>
        <Link href="/dashboard/appointments/new" className="btn btn-primary btn-sm">
          Crear reserva
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
