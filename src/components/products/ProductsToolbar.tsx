// code/src/components/products/ProductsToolbar.tsx

import Link from "next/link"
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, FunnelIcon, EyeIcon, EyeSlashIcon, BackspaceIcon, ArrowPathIcon } from "@heroicons/react/24/solid"
import SearchBar from "@/components/SearchBar"
import type { ProductsInventory } from "./useProductsInventory"

type ProductsToolbarProps = { inventory: ProductsInventory }

export default function ProductsToolbar({ inventory }: ProductsToolbarProps) {
  const { inventorySegment, selectInventorySegment, setDrawerOpen, viewMode, setViewMode, filteredProducts, operationalProducts, totalProducts, groupedCounts, typeFilter, setTypeFilter, isTableExpanded, setIsTableExpanded, mutate, isLoading, canCreateProducts, error, search, setSearch, stateFilter, setStateFilter, stateOptions, stateLabelMap, conditionFilter, setConditionFilter, conditionOptions, conditionLabelMap, capacityFilter, setCapacityFilter, capacities, locationFilter, setLocationFilter, locations, imeiSearch, setImeiSearch, clearFilters, showSensitiveColumns, setShowSensitiveColumns, hasNext, setCursor, data, orderBy, setOrderBy, senadoFilter, setSenadoFilter, brandFilter, setBrandFilter, colorFilter, setColorFilter, originFilter, setOriginFilter, batteryMin, setBatteryMin, batteryMax, setBatteryMax } = inventory
  const visibleProducts = inventorySegment === "TRADE_INS" ? operationalProducts : filteredProducts

  return (
    <>
      {/* <div className="flex justify-between items-center">
        <div className="flex flex-wrap flex-row items-center justify-between gap-2">
        </div>
      </div> */}

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>Error cargando productos: {String((error as any)?.message ?? error)}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-box bg-base-200 p-2 items-center">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="join border border-base-400">
            {([
              ["PHONES", "Equipos"],
              ["ACCESSORIES", "Accesorios"],
              ["TRADE_INS", "Canjes"],
            ] as const).map(([segment, label]) => (
              <button key={segment} type="button" className={`w-auto flex-1 btn join-item btn-sm text-nowrap ${inventorySegment === segment ? "btn-primary" : "btn-ghost"}`} onClick={() => selectInventorySegment(segment)}>
                {label}
              </button>
            ))}
          </div>
          <div className="sm:ml-2 flex items-center gap-2">
            <div className="join border-[0.1em] border-base-content/10">
              <button
                type="button"
                className={`join-item btn btn-xs sm:btn-sm ${viewMode === "DETAIL" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewMode("DETAIL")}
                title="Detalle de Stock"
              >
                Detalle
              </button>
              <button
                type="button"
                className={`join-item btn btn-xs sm:btn-sm ${viewMode === "GENERAL" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewMode("GENERAL")}
                title="Stock General"
              >
                General
              </button>
            </div>
          </div>
        </div>
        <SearchBar placeholder="Buscar productos..." onSearch={setSearch} search={search} />
        <select className="select select-bordered select-xs sm:select-sm" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {stateOptions.map((state) => <option key={state} value={state}>{stateLabelMap[state] ?? state}</option>)}
        </select>
        <select className="select select-bordered select-xs sm:select-sm" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="">Todas las condiciones</option>
          {conditionOptions.map((condition) => <option key={condition} value={condition}>{conditionLabelMap[condition] ?? condition}</option>)}
        </select>
        <select className="select select-bordered select-xs sm:select-sm" value={capacityFilter} onChange={(e) => setCapacityFilter(e.target.value)}>
          <option value="">Todos los grados / GB</option>
          {capacities.map((capacity) => <option key={capacity} value={String(capacity)}>{capacity} GB</option>)}
        </select>
        <select className="select select-bordered select-xs sm:select-sm" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="">Todas las ubicaciones</option>
          {locations.map((location) => <option key={location} value={location}>{location}</option>)}
        </select>
        <input className="input input-bordered input-xs sm:input-sm" value={imeiSearch} onChange={(e) => setImeiSearch(e.target.value)} placeholder="Buscar / escanear IMEI" inputMode="numeric" autoComplete="off" />
        <button type="button" className="btn btn-ghost btn-xs sm:btn-sm" onClick={() => setShowSensitiveColumns((prev) => !prev)} title={showSensitiveColumns ? "Ocultar columnas sensibles" : "Mostrar columnas sensibles"}>
          {showSensitiveColumns ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
          {showSensitiveColumns ? "Ocultar sensibles" : "Mostrar sensibles"}
        </button>
      </div>

      <div className="hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 h-auto">
          <div className="flex flex-grow flex-wrap gap-2 sm:gap-4 rounded-box bg-base-200 p-2 items-center">
            <SearchBar placeholder="Buscar por modelo..." onSearch={setSearch} search={search} />
            <button type="button" className="btn btn-outline btn-xs sm:btn-sm" onClick={() => setDrawerOpen(true)}>
              <FunnelIcon className="size-5 sm:size-6" />
              Filtros
            </button>
            <select
              className="select select-bordered select-xs sm:select-sm"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}>
              <option value="alpha_asc">Alfabético A-Z</option>
              <option value="alpha_desc">Alfabético Z-A</option>
              <option value="created_desc">Más Nuevos Creados</option>
              <option value="created_asc">Más Viejos Creados</option>
              <option value="updated_desc">Más Nuevos Modificados</option>
              <option value="updated_asc">Más Viejos Modificados</option>
            </select>
            <select
              className="select select-bordered select-xs sm:select-sm"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {stateLabelMap[s] ?? s}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered select-xs sm:select-sm"
              value={senadoFilter}
              onChange={(e) => setSenadoFilter(e.target.value)}
            >
              <option value="">Todas las señas</option>
              <option value="false">No señados</option>
              <option value="true">Señados</option>
            </select>
            <button type="button" className="btn btn-ghost btn-xs sm:btn-sm" onClick={() => clearFilters()}>
              Limpiar
            </button>
            {hasNext ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isLoading}
                onClick={() => setCursor(data?.nextCursor ?? null)}
                title="Cargar más"
              >
                {isLoading ? <span className="loading loading-spinner loading-xs"></span> : "Cargar más"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {viewMode === "DETAIL" ? (
          <div className="flex flex-row items-center gap-1">
            <span className="ml-1 text-sm text-base-content/60">Resultados {isLoading ? <span className="loading loading-spinner loading-xs"></span> : visibleProducts.length}</span>
            <span className="text-sm text-base-content/30">de</span>
            <span className="text-sm text-base-content/60">{totalProducts}</span>
              {hasNext ? <button type="button" className="ml-2 btn btn-outline btn-xs sm:btn-sm" disabled={isLoading} onClick={() => setCursor(data?.nextCursor ?? null)}>Cargar más</button> : null}
          </div>
        ) : (
          <div className="flex flex-row items-center gap-1">
            <span className="ml-1 text-sm text-base-content/60">Grupos {groupedCounts.groups}</span>
            <span className="text-sm text-base-content/30">| Items {groupedCounts.instances}</span>
            <span className="text-sm text-base-content/30">| Stock {groupedCounts.totalStock}</span>
            <span className="text-sm text-base-content/30">| Disp. {groupedCounts.totalAvail}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-outline btn-xs border-base-content/10 sm:btn-sm" onClick={() => setDrawerOpen(true)}>
            <FunnelIcon className="size-5" />
            Filtros
          </button>
          <button type="button" className="btn btn-outline btn-xs border-base-content/10 sm:btn-sm" onClick={() => clearFilters()}>
            Limpiar
            <BackspaceIcon className="size-4" />
          </button>
          <button type="button" className="btn btn-outline btn-xs border-base-content/10 sm:btn-sm" onClick={() => mutate()}>
            {isLoading ? <span className="loading loading-spinner loading-xs"></span> : "Refrescar"}
            <ArrowPathIcon className="size-5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs sm:btn-sm btn-outline border border-base-content/10 flex items-center"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            title={isTableExpanded ? "Contraer tabla" : "Expandir tabla"}
          >
            {isTableExpanded ? "Comprimir" : "Expandir "} Tabla
            {isTableExpanded ? <ArrowsPointingInIcon className="size-5 sm:size-6" /> : <ArrowsPointingOutIcon className="size-5 sm:size-6" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {(brandFilter || conditionFilter || colorFilter || capacityFilter || originFilter || stateFilter || senadoFilter || batteryMin || batteryMax) && (
          <div className="flex items-center gap-2">
            {brandFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Marca: {brandFilter}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setBrandFilter("")}>
                  ✕
                </button>
              </span>
            )}
            {conditionFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Condición: {conditionLabelMap[conditionFilter]}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setConditionFilter("")}>
                  ✕
                </button>
              </span>
            )}
            {colorFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Color: {colorFilter}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setColorFilter("")}>
                  ✕
                </button>
              </span>
            )}
            {capacityFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Capacidad: {capacityFilter} GB
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setCapacityFilter("")}>
                  ✕
                </button>
              </span>
            )}
            {originFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Origen: {originFilter}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setOriginFilter("")}>
                  x
                </button>
              </span>
            )}
            {stateFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Estado: {stateLabelMap[stateFilter]}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setStateFilter("")}>
                  ✕
                </button>
              </span>
            )}
            {senadoFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Seña: {senadoFilter === "true" ? "Señados" : "No señalados"}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setSenadoFilter("")}>
                  x
                </button>
              </span>
            )}
            {(batteryMin || batteryMax) && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Batería: {batteryMin ? `Min ${batteryMin}%` : ""}
                {batteryMin && batteryMax ? " - " : ""}
                {batteryMax ? `Max ${batteryMax}%` : ""}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle ml-1"
                  onClick={() => {
                    setBatteryMin("")
                    setBatteryMax("")
                  }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>


    </>
  )
}
