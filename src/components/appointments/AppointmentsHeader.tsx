"use client"

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
        </button>
        <Link href="/dashboard/appointments/new" className="btn btn-primary btn-sm">
          Crear reserva
        </Link>
      </div>
    </div>
  )
}
