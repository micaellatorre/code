"use client"

import { useState } from 'react'

export interface FilterOption {
  label: string
  value: string
}

export interface FilterDefinition {
  /** Identificador de la propiedad de filtro. Debe ser único dentro del panel. */
  key: string
  /** Etiqueta visible para el filtro. */
  label: string
  /** Lista de opciones disponibles para este filtro. Un valor vacío indica "todos". */
  options: FilterOption[]
}

export interface FilterPanelProps {
  /** Definiciones de los distintos filtros que se mostrarán. */
  filters: FilterDefinition[]
  /**
   * Función opcional que recibe el estado actualizado de todos los filtros
   * cada vez que el usuario selecciona una opción. Si no se pasa, el
   * componente controlará el estado internamente sin notificar al padre.
   */
  onChange?: (values: Record<string, string>) => void
}

/**
 * Panel de filtros que utiliza el componente Drawer de DaisyUI. Muestra un
 * botón "Filtros" que, al activarse, despliega un panel lateral desde
 * la derecha con los distintos selectores de filtros. Internamente se
 * gestiona el estado de los filtros y, si se proporciona `onChange`,
 * notifica al componente padre cada vez que cambian los valores.
 */
export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleSelect = (key: string, value: string) => {
    const next = { ...values, [key]: value }
    setValues(next)
    if (onChange) onChange(next)
  }

  // No mostrar el panel si no hay filtros definidos
  if (!filters || filters.length === 0) return null

  return (
    <div className="drawer drawer-end">
      {/* Checkbox oculto que controla la apertura del drawer */}
      <input id="filter-drawer" type="checkbox" className="drawer-toggle" />
      {/* Contenido visible cuando el drawer está cerrado: solo el botón */}
      <div className="drawer-content">
        <label htmlFor="filter-drawer" className="btn btn-outline">
          Filtros
        </label>
      </div>
      {/* Panel lateral que se muestra al activar el drawer */}
      <div className="drawer-side z-40">
        {/* Capa de superposición que cierra el drawer al hacer clic fuera */}
        <label htmlFor="filter-drawer" className="drawer-overlay"></label>
        <aside className="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
          <h3 className="font-bold text-lg mb-4">Filtros</h3>
          <form className="flex flex-col gap-4">
            {filters.map((filter) => (
              <div className="form-control" key={filter.key}>
                <label className="label">
                  <span className="label-text">{filter.label}</span>
                </label>
                <select
                  className="select select-bordered"
                  value={values[filter.key] ?? ''}
                  onChange={(e) => handleSelect(filter.key, e.target.value)}
                >
                  <option value="">Todos</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </form>
        </aside>
      </div>
    </div>
  )
}