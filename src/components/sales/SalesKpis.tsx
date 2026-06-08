"use client"

import { formatUsd } from "./salesUtils"
import type { SalesKpisValue } from "./types"

export default function SalesKpis({ kpis, canSeeMargin }: { kpis: SalesKpisValue; canSeeMargin: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Ventas totales</p>
        <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.totalSales)}</p>
        <p className="mt-1 text-xs text-base-content/50">
          Min {formatUsd(kpis.minSale)} / Max {formatUsd(kpis.maxSale)}
        </p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Ventas del mes</p>
        <p className="mt-2 text-2xl font-bold">{kpis.monthCount}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Ticket promedio</p>
        <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.averageTicket)}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-xs font-semibold uppercase text-base-content/50">Margen bruto</p>
        {canSeeMargin ? (
          <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.grossMargin)}</p>
        ) : (
          <p className="mt-3 text-sm text-base-content/50">Restringido por rol</p>
        )}
      </div>
    </div>
  )
}
