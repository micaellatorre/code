"use client"

import { formatUsd } from "./salesUtils"
import type { SalesKpisValue } from "./types"

export default function SalesKpis({ kpis, isAdmin }: { kpis: SalesKpisValue; isAdmin: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-5">
      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">USD ventas totales</p>
        <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.totalSales)}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">USD ventas del mes</p>
        <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.monthSalesTotal)}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">Ventas del mes</p>
        <p className="mt-2 text-2xl font-bold">{kpis.monthCount}</p>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">Venta promedio</p>
        <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.averageTicket)}</p>
      </div>
      {isAdmin ? (
        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <p className="text-xs font-semibold uppercase text-base-content/50">Margen bruto</p>
          <p className="mt-2 text-2xl font-bold">{formatUsd(kpis.grossMargin)}</p>
        </div>
      ) : null}
    </div>
  )
}
