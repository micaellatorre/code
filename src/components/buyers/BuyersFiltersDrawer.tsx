"use client"

import { XMarkIcon } from "@heroicons/react/24/outline"
import { BUYER_TYPE_FILTERS } from "./buyerTypes"
import type { BuyerTypeFilter, BuyersFilters } from "./types"

type BuyersFiltersDrawerProps = {
  open: boolean
  filters: BuyersFilters
  onClose: () => void
  onChange: (filters: BuyersFilters) => void
  onClear: () => void
}

function updateFilter(filters: BuyersFilters, key: keyof BuyersFilters, value: string) {
  return { ...filters, [key]: value }
}

export default function BuyersFiltersDrawer({
  open,
  filters,
  onClose,
  onChange,
  onClear,
}: BuyersFiltersDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <button
        type="button"
        className="fixed inset-0 bg-black/50 pointer-events-auto backdrop-blur-[1px]"
        aria-label="Cerrar filtros"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 h-full w-80 overflow-y-auto bg-base-200 text-base-content shadow-xl pointer-events-auto">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Filtros</h2>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Cerrar filtros">
              <XMarkIcon className="size-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <label className="form-control">
              <span className="label">
                <span className="label-text">Tipo</span>
              </span>
              <select
                className="select select-bordered"
                value={filters.type}
                onChange={(event) => onChange(updateFilter(filters, "type", event.target.value as BuyerTypeFilter))}
              >
                {BUYER_TYPE_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            {[
              ["customer", "Nombre / Cliente"],
              ["dni", "DNI"],
              ["cuit", "CUIT"],
              ["phone", "Telefono"],
              ["instagram", "Instagram"],
              ["email", "Email"],
              ["province", "Provincia"],
              ["city", "Localidad"],
            ].map(([key, label]) => (
              <label key={key} className="form-control">
                <span className="label">
                  <span className="label-text">{label}</span>
                </span>
                <input
                  type="text"
                  value={filters[key as keyof BuyersFilters]}
                  onChange={(event) => onChange(updateFilter(filters, key as keyof BuyersFilters, event.target.value))}
                  className="input input-bordered"
                />
              </label>
            ))}

            <div className="divider" />

            <button type="button" className="btn btn-outline" onClick={onClear}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
