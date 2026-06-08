"use client"

import { formatMoney } from "./appointmentUtils"
import type { AppointmentKpis } from "./types"

export default function AppointmentsKpis({ kpis }: { kpis: AppointmentKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Reservas activas</p>
        <p className="mt-2 text-2xl font-bold">{kpis.activeCount}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Señas en caja</p>
        <p className="mt-2 text-2xl font-bold">{formatMoney(kpis.depositsTotal)}</p>
        <p className="mt-1 text-xs text-base-content/50">Se calcula desde señas registradas en la reserva.</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Valor total reservado</p>
        <p className="mt-2 text-2xl font-bold">{formatMoney(kpis.reservedValue)}</p>
        <p className="mt-1 text-xs text-base-content/50">Fallback con precio de venta del producto.</p>
      </div>
    </div>
  )
}
