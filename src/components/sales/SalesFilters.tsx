"use client"

import type { SaleOriginFilter, SaleStatusFilter } from "./types"

const origins: { value: SaleOriginFilter; label: string }[] = [
  { value: "ALL", label: "Todos los origenes" },
  { value: "Directa", label: "Directa" },
  { value: "Reserva", label: "Reserva" },
  { value: "Instagram", label: "Instagram" },
  { value: "Local", label: "Local" },
  { value: "Otro", label: "Otro" },
]

const statuses: { value: SaleStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas las ventas" },
  { value: "CONFIRMADA", label: "Confirmadas" },
  { value: "SENADA", label: "Senadas" },
  { value: "CANCELADA", label: "Canceladas" },
]

type SalesFiltersProps = {
  searchQuery: string
  setSearchQuery: (value: string) => void
  originFilter: SaleOriginFilter
  setOriginFilter: (value: SaleOriginFilter) => void
  statusFilter: SaleStatusFilter
  setStatusFilter: (value: SaleStatusFilter) => void
  dateFrom: string
  setDateFrom: (value: string) => void
  dateTo: string
  setDateTo: (value: string) => void
  count: number
  onExport: () => void
}

export default function SalesFilters(props: SalesFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-3 xl:flex-row xl:items-center">
      <input
        type="text"
        className="input input-bordered input-sm min-w-64 flex-1"
        placeholder="Buscar por equipo, cliente o id..."
        value={props.searchQuery}
        onChange={(event) => props.setSearchQuery(event.target.value)}
      />
      <select className="select select-bordered select-sm" value={props.originFilter} onChange={(event) => props.setOriginFilter(event.target.value as SaleOriginFilter)}>
        {origins.map((origin) => (
          <option key={origin.value} value={origin.value}>
            {origin.label}
          </option>
        ))}
      </select>
      <select className="select select-bordered select-sm" value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value as SaleStatusFilter)}>
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <input type="date" className="input input-bordered input-sm" value={props.dateFrom} onChange={(event) => props.setDateFrom(event.target.value)} aria-label="Desde" />
      <input type="date" className="input input-bordered input-sm" value={props.dateTo} onChange={(event) => props.setDateTo(event.target.value)} aria-label="Hasta" />
      <span className="whitespace-nowrap text-sm text-base-content/60">{props.count} registros</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={props.onExport}>
        Exportar
      </button>
    </div>
  )
}
