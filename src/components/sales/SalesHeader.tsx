"use client"

import Link from "next/link"

export default function SalesHeader({ canCreate, onExport }: { canCreate: boolean; onExport: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Ventas / Canjes</h1>
        <p className="mt-1 text-sm text-base-content/60">Registro de operaciones comerciales y margen de rentabilidad.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onExport}>
          Exportar
        </button>
        {canCreate ? (
          <Link href="/dashboard/sales/new" className="btn btn-primary btn-sm">
            Nueva Venta
          </Link>
        ) : null}
      </div>
    </div>
  )
}
