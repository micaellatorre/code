// code/src/components/products/ProductsFiltersDrawer.tsx

import type { ProductsInventory } from "./useProductsInventory"

type ProductsFiltersDrawerProps = { inventory: ProductsInventory }

export default function ProductsFiltersDrawer({ inventory }: ProductsFiltersDrawerProps) {
  const { drawerOpen, setDrawerOpen, conditionFilter, setConditionFilter, conditionOptions, conditionLabelMap, conditions, batteryMin, setBatteryMin, batteryMax, setBatteryMax, colorFilter, setColorFilter, colors, originFilter, setOriginFilter, capacityFilter, setCapacityFilter, capacities, stateFilter, setStateFilter, stateOptions, stateLabelMap, clearFilters } = inventory

  return (
    <>
      {/* Drawer for filters */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <label
            htmlFor="filters-drawer"
            className="fixed inset-0 bg-black/50 cursor-pointer pointer-events-auto backdrop-blur-[0.1em]"
            onClick={() => setDrawerOpen(false)}
          ></label>
          <div className="fixed right-0 top-0 h-full w-80 bg-base-200 text-base-content shadow-xl pointer-events-auto overflow-y-auto">
            <div className="menu p-4 min-h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Filtros</h3>
                <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setDrawerOpen(false)}>
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Condición</span>
                  </label>
                  <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Todas las condiciones</option>
                    {conditionOptions
                      .filter((opt) => conditions.includes(opt))
                      .map((c) => (
                        <option key={c} value={c}>
                          {conditionLabelMap[c] ?? c}
                        </option>
                      ))}
                  </select>
                  {conditionFilter && (
                    <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1" onClick={() => setConditionFilter("")}>
                      <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                      ✕
                    </button>
                  )}
                </div>

                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Batería (%)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="form-control flex-1">
                      <label className="label">
                        <span className="label-text text-xs">Mínimo</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={batteryMin}
                        placeholder="Min"
                        onChange={(e) => setBatteryMin(e.target.value)}
                        className="input input-bordered input-sm"
                      />
                    </div>
                    <div className="form-control flex-1">
                      <label className="label">
                        <span className="label-text text-xs">Máximo</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="Max"
                        value={batteryMax}
                        onChange={(e) => setBatteryMax(e.target.value)}
                        className="input input-bordered input-sm"
                      />
                    </div>
                  </div>
                  {(batteryMin || batteryMax) && (
                    <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1"
                      onClick={() => {
                        setBatteryMin("")
                        setBatteryMax("")
                      }}
                    >
                      <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                      ✕
                    </button>
                  )}
                </div>

                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Color</span>
                  </label>
                  <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Todos los colores</option>
                    {colors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {colorFilter && (
                    <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1" onClick={() => setColorFilter("")}>
                      <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                      ✕
                    </button>
                  )}
                </div>

                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Origen</span>
                  </label>
                  <input
                    type="search"
                    value={originFilter}
                    onChange={(e) => setOriginFilter(e.target.value)}
                    placeholder="Buscar origen"
                    className="input input-bordered input-sm"
                  />
                  {originFilter && (
                    <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1" onClick={() => setOriginFilter("")}>
                      <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                      x
                    </button>
                  )}
                </div>

                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Capacidad (GB)</span>
                  </label>
                  <select value={capacityFilter} onChange={(e) => setCapacityFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Todas las capacidades</option>
                    {capacities.map((cap) => (
                      <option key={cap} value={String(cap)}>
                        {cap} GB
                      </option>
                    ))}
                  </select>
                  {capacityFilter && (
                    <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1" onClick={() => setCapacityFilter("")}>
                      <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                      ✕
                    </button>
                  )}
                </div>

                <div className="form-control relative">
                  <label className="label">
                    <span className="label-text font-semibold">Estado</span>
                  </label>
                  <div className="form-control">
                    <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="select select-sm bg-base-100 border-[0.1em] border-base-content/10">
                      <option value="">Todos los estados</option>
                      {stateOptions.map((s) => (
                        <option key={s} value={s}>
                          {stateLabelMap[s] ?? s}
                        </option>
                      ))}
                    </select>
                    {stateFilter && (
                      <button className="btn btn-xs text-red-500 absolute right-1 top-0 mt-1" onClick={() => setStateFilter("")}>
                        <span className="text-xs text-base-content/30 mr-2">Limpiar</span>
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="divider"></div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    clearFilters()
                    setDrawerOpen(false)
                  }}
                >
                  Limpiar todos los filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        id="filters-drawer"
        type="checkbox"
        className="hidden"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />


    </>
  )
}
