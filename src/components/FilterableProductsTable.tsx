"use client"

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
// SerializedProduct mirrors the shape we send from the server page:
// Decimal and Date fields are converted to strings (or null) so they can
// be safely passed into a Client Component.
type SerializedProduct = {
  id: string
  tenantId: string
  type: string
  brand: string | null
  imei: string | null
  modelName: string
  capacityGB: number | null
  condition: string | null
  color: string | null
  batteryPct: number | null
  purchaseDate: string | null
  costPrice: string | null
  salePrice: string | null
  shippingCost: string | null
  state: string
  status: string
  stock: number
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}
import SearchBar from '@/components/SearchBar'

type FilterableProductsTableProps = {
  products: SerializedProduct[]
}

function formatDecimal(value: unknown) {
  if (value == null) return '-'
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n.toFixed(2) : value
  }
  if (typeof value === 'number') return value.toFixed(2)
  try {
    // Decimal-like objects may have toString
    const s = String(value)
    const n = parseFloat(s)
    return Number.isFinite(n) ? n.toFixed(2) : s
  } catch {
    return String(value)
  }
}

export default function FilterableProductsTable({ products }: FilterableProductsTableProps) {
  // Keep a local copy of products so we can do optimistic updates when
  // changing stock from the UI.
  const [productsLocal, setProductsLocal] = useState<SerializedProduct[]>(products)
  useEffect(() => setProductsLocal(products), [products])

  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [conditionFilter, setConditionFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [batteryMin, setBatteryMin] = useState<string>('')
  const [batteryMax, setBatteryMax] = useState<string>('')
  const [colorFilter, setColorFilter] = useState<string>('')
  const [capacityFilter, setCapacityFilter] = useState<string>('')
  const [stateFilter, setStateFilter] = useState<string>('')
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editingStockValue, setEditingStockValue] = useState<string>('')
  const [savingStockId, setSavingStockId] = useState<string | null>(null)
  const [savingStateId, setSavingStateId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Product states from prisma schema enum ProductState
  const stateOptions = [
    'EN_STOCK',
    'EN_CAMINO',
    'EN_REPARACION',
    'CON_CLIENTE',
    'VENDIDO',
  ] as const

  const stateColorMap: Record<string, string> = {
    EN_STOCK: 'badge-success',
    EN_CAMINO: 'badge-info',
    EN_REPARACION: 'badge-warning',
    CON_CLIENTE: 'badge-primary',
    VENDIDO: 'badge-outline',
  }

  const brands = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.brand).filter(Boolean) as string[])), [productsLocal])
  const conditions = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.condition).filter(Boolean) as string[])), [productsLocal])

  const conditionOptions = ['A_PLUS', 'OEM', 'ASIS', 'ASIS_PLUS', 'SEALED'] as const
  const conditionLabelMap: Record<string, string> = {
    A_PLUS: 'A+',
    OEM: 'OEM',
    ASIS: 'ASIS',
    ASIS_PLUS: 'ASIS+',
    SEALED: 'Sellado',
  }

  // Derived filter values
  const colors = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.color).filter(Boolean) as string[])), [productsLocal])
  const capacities = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.capacityGB).filter((n): n is number => n != null) as number[])).sort((a, b) => a - b), [productsLocal])

  const stateLabelMap: Record<string, string> = {
    EN_STOCK: 'En stock',
    EN_CAMINO: 'En camino',
    EN_REPARACION: 'En reparación',
    CON_CLIENTE: 'Con cliente',
    VENDIDO: 'Vendido',
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = batteryMin === '' ? null : Number(batteryMin)
    const max = batteryMax === '' ? null : Number(batteryMax)

    return productsLocal.filter((p) => {
      const model = p.modelName ?? ''
      const matchesSearch = q ? model.toLowerCase().includes(q) : true
      const matchesBrand = brandFilter ? p.brand === brandFilter : true
      const matchesCondition = conditionFilter ? p.condition === conditionFilter : true
      const matchesType = typeFilter ? p.type === typeFilter : true
      const matchesColor = colorFilter ? p.color === colorFilter : true
      const matchesCapacity = capacityFilter ? p.capacityGB === Number(capacityFilter) : true
      const matchesState = stateFilter ? p.state === stateFilter : true

      let matchesBattery = true
      if (min != null || max != null) {
        if (p.batteryPct == null) {
          matchesBattery = false
        } else {
          if (min != null && p.batteryPct < min) matchesBattery = false
          if (max != null && p.batteryPct > max) matchesBattery = false
        }
      }

      return matchesSearch && matchesBrand && matchesCondition && matchesType && matchesColor && matchesCapacity && matchesState && matchesBattery
    })
  }, [search, brandFilter, conditionFilter, typeFilter, colorFilter, capacityFilter, stateFilter, batteryMin, batteryMax, productsLocal])

  // Clear all filters
  function clearFilters() {
    setSearch('')
    setBrandFilter('')
    setConditionFilter('')
    setBatteryMin('')
    setBatteryMax('')
    setColorFilter('')
    setCapacityFilter('')
    setStateFilter('')
  }

  async function persistStockUpdate(id: string, newStock: number) {
    setSavingStockId(id)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      })
      if (!res.ok) throw new Error('server error')
      const updated = await res.json()
      setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, stock: updated.stock } : p)))
    } catch (err) {
      // revert by re-fetching from server or by a simple noop here. For now,
      // revert the local change by setting the product back from props.
      const original = products.find((p) => p.id === id)
      if (original) setProductsLocal((prev) => prev.map((p) => (p.id === id ? original : p)))
      console.error('Failed to persist stock update', err)
    } finally {
      setSavingStockId(null)
    }
  }

  function startEditStock(id: string, value: number) {
    setEditingStockId(id)
    setEditingStockValue(String(value ?? 0))
  }

  function cancelEditStock() {
    setEditingStockId(null)
    setEditingStockValue('')
  }

  function commitEditStock(id: string) {
    const v = parseInt(editingStockValue || '0', 10)
    if (Number.isNaN(v) || v < 0) return
    // optimistic
    setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, stock: v } : p)))
    setEditingStockId(null)
    setEditingStockValue('')
    persistStockUpdate(id, v)
  }

  function changeStockBy(id: string, delta: number) {
    const p = productsLocal.find((x) => x.id === id)
    if (!p) return
    const newStock = Math.max(0, (p.stock ?? 0) + delta)
    // optimistic
    setProductsLocal((prev) => prev.map((prod) => (prod.id === id ? { ...prod, stock: newStock } : prod)))
    persistStockUpdate(id, newStock)
  }

  async function persistStateUpdate(id: string, newState: string) {
    setSavingStateId(id)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      })
      if (!res.ok) throw new Error('server error')
      const updated = await res.json()
      setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, state: updated.state } : p)))
    } catch (err) {
      const original = products.find((p) => p.id === id)
      if (original) setProductsLocal((prev) => prev.map((p) => (p.id === id ? original : p)))
      console.error('Failed to persist state update', err)
    } finally {
      setSavingStateId(null)
    }
  }

  function changeState(id: string, newState: string) {
    // optimistic update
    setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, state: newState } : p)))
    persistStateUpdate(id, newState)
  }

  async function deleteProduct(id: string) {
    const ok = window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')
    if (!ok) return
    setDeletingId(id)

    // keep original and index so we can revert if delete fails
    const originalIndex = productsLocal.findIndex((p) => p.id === id)
    const original = productsLocal[originalIndex]

    // optimistic remove
    setProductsLocal((prev) => prev.filter((p) => p.id !== id))

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      // success - nothing else to do (row already removed)
    } catch (err) {
      // revert by reinserting at original index
      setProductsLocal((prev) => {
        const copy = prev.slice()
        copy.splice(originalIndex, 0, original)
        return copy
      })
      console.error('Failed to delete product', err)
      alert('No se pudo eliminar el producto. Intente de nuevo.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 !h-full flex-1">
      <div className="flex justify-between items-center">
        <div className="flex flex-row items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">
            Productos
            <span className="ml-4 text-sm text-base-content/60">
              - Resultados {filteredProducts.length}
            </span>
            <span className="ml-1 text-sm text-base-content/30">
              de
            </span>
            <span className="ml-1 text-sm text-base-content/30">
              {products.length}
            </span>
          </h2>
          <div className="ml-2 flex rounded-box border border-base-content/10 items-center gap-2">
            <div className="join">
              <button
                type="button"
                className={`join-item btn btn-sm ${typeFilter === 'PHONE' ? 'btn-active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === 'PHONE' ? '' : 'PHONE')}
              >
                Teléfonos
              </button>
              <div className='divider divider-horizontal mx-[-4px]'></div>
              <button
                type="button"
                className={`join-item btn btn-sm ${typeFilter === 'ACCESSORY' ? 'btn-active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === 'ACCESSORY' ? '' : 'ACCESSORY')}
              >
                Accesorios
              </button>
            </div>
            {typeFilter ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setTypeFilter('')}>✕</button>
            ) : null}
          </div>
        </div>
        <Link href="/products/new" className="btn btn-primary">
          Nuevo Producto
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 h-auto">
        <div className="flex items-center gap-2">
          <SearchBar placeholder="Buscar por modelo..." onSearch={setSearch} />
          {search ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearch('')}
              className="btn btn-ghost btn-sm"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="select select-bordered w-full max-w-xs"
          >
            <option value="">Filtrar por Condición</option>
            {conditionOptions
              .filter((opt) => conditions.includes(opt))
              .map((c) => (
                <option key={c} value={c}>
                  {conditionLabelMap[c] ?? c}
                </option>
              ))}
          </select>
          {conditionFilter ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setConditionFilter('')}>✕</button>
          ) : null}
        </div>

        <div className="join join-vertical relative -mt-0.5 max-w-[150px]">
          <label className='flex flex-row text-right items-center join-item input input-bordered input-xs w-full min-w-[140px]'>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[2.5em] opacity-55 mx-1">
              <path d="M4.5 9.75a.75.75 0 0 0-.75.75V15c0 .414.336.75.75.75h6.75A.75.75 0 0 0 12 15v-4.5a.75.75 0 0 0-.75-.75H4.5Z" />
              <path fillRule="evenodd" d="M3.75 6.75a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-.037c.856-.174 1.5-.93 1.5-1.838v-2.25c0-.907-.644-1.664-1.5-1.837V9.75a3 3 0 0 0-3-3h-15Zm15 1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5h15Z" clipRule="evenodd" />
            </svg>
            <input
              type="number"
              min={0}
              max={100}
              value={batteryMin}
              placeholder="Min"
              onChange={(e) => setBatteryMin(e.target.value)}
              className='w-full'
            />
          </label>
          {batteryMin ? <button className="absolute right-0 top-0 btn btn-ghost btn-xs" onClick={() => setBatteryMin('')}>✕</button> : null}
          <label className='flex flex-row text-right items-center join-item input input-bordered input-xs w-full min-w-[140px]'>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[2.5em] opacity-55 mx-1">
              <path fillRule="evenodd" d="M3.75 6.75a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-.037c.856-.174 1.5-.93 1.5-1.838v-2.25c0-.907-.644-1.664-1.5-1.837V9.75a3 3 0 0 0-3-3h-15Zm15 1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5h15ZM4.5 9.75a.75.75 0 0 0-.75.75V15c0 .414.336.75.75.75H18a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-.75-.75H4.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Max"
              value={batteryMax}
              onChange={(e) => setBatteryMax(e.target.value)}
              className='w-full'
            />
          </label>
          {batteryMax ? <button className="absolute right-0 bottom-0 btn btn-ghost btn-xs" onClick={() => setBatteryMax('')}>✕</button> : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="select select-bordered w-full max-w-xs"
          >
            <option value="">Todos los colores</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {colorFilter ? <button className="btn btn-ghost btn-sm" onClick={() => setColorFilter('')}>✕</button> : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            className="select select-bordered w-full max-w-xs"
          >
            <option value="">Todas las capacidades</option>
            {capacities.map((cap) => (
              <option key={cap} value={String(cap)}>
                {cap} GB
              </option>
            ))}
          </select>
          {capacityFilter ? <button className="btn btn-ghost btn-sm" onClick={() => setCapacityFilter('')}>✕</button> : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="select select-bordered w-full max-w-xs"
          >
            <option value="">Todos los estados</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {stateLabelMap[s] ?? s}
              </option>
            ))}
          </select>
          {stateFilter ? <button className="btn btn-ghost btn-sm" onClick={() => setStateFilter('')}>✕</button> : null}
        </div>

        <button className="btn btn-ghost" onClick={clearFilters}>Limpiar filtros</button>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 h-[70dvh]">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Agregado</th>
              {/* <th>Editado</th> */}
              <th>Modelo</th>
              <th>IMEI</th>
              <th>Bateria %</th>
              <th>Color</th>
              <th>Capacidad (GB)</th>
              <th>Condición</th>
              <th>Costo (USD)</th>
              <th>Precio Venta (USD)</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody className='h-full'>
            {filteredProducts.map((p) => (
              <tr key={p.id}>
                <td className='text-xs text-base-content/60'>
                  <div className='tooltip tooltip-right' data-tip={p.createdAt ? new Date(p.createdAt).toLocaleString('es-AR') : ''}>
                    <span className="underline decoration-dotted cursor-help">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                      }) : '-'}
                    </span>
                  </div>
                </td>
                <td>
                  {p.notes ? (
                    <div className="tooltip tooltip-bottom" data-tip={p.notes ?? ''}>
                      <span className="underline decoration-dotted cursor-help">
                        {p.modelName}
                      </span>
                    </div>
                  ) : (
                    <span>{p.modelName}</span>
                  )}
                </td>
                <td>{p.imei}</td>
                <td>
                  {p.batteryPct != null ? (
                    <>
                      {p.batteryPct}<span className="text-xs text-base-content/50"> %</span>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{p.color ?? '-'}</td>
                <td>
                  {p.capacityGB != null ?
                    (
                      <>
                        {p.capacityGB}<span className="text-xs text-base-content/50"> GB</span>
                      </>
                    ) : (
                      '-'
                    )
                  }
                </td>
                <td>
                  {p.condition == null ? '-' : conditionLabelMap[p.condition] ?? p.condition}
                </td>
                <td><span className='text-xs text-base-content/50'>$ </span>{formatDecimal((p as any).costPrice)}</td>
                <td><span className='text-xs text-base-content/50'>$ </span>{formatDecimal((p as any).salePrice)}</td>
                <td>
                  {editingStockId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        step={1}
                        value={editingStockValue}
                        onChange={(e) => setEditingStockValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditStock(p.id)
                          if (e.key === 'Escape') cancelEditStock()
                        }}
                        onBlur={() => commitEditStock(p.id)}
                        className="input input-sm w-20"
                      />
                      <button className="btn btn-ghost btn-xs" onClick={() => commitEditStock(p.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={cancelEditStock}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>

                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-row btn-group gap-1 items-center">
                        <button
                          className="btn btn-ghost btn-xs"
                          aria-label="increment stock"
                          disabled={savingStockId === p.id}
                          onClick={() => changeStockBy(p.id, 1)}
                        >
                          ▲
                        </button>
                        <span className="cursor-pointer" onClick={() => startEditStock(p.id, p.stock)}>
                          {p.stock}
                        </span>
                        <button
                          className="btn btn-ghost btn-xs"
                          aria-label="decrement stock"
                          disabled={savingStockId === p.id}
                          onClick={() => changeStockBy(p.id, -1)}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <div className="dropdown dropdown-end relative">
                    <label tabIndex={0} className="btn btn-ghost btn-sm gap-2">
                      <span className={`badge ${stateColorMap[p.state] ?? 'badge-ghost'}`}>{p.state}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </label>
                    <ul tabIndex={0} className="fixed dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 !z-[1000]">
                      {stateOptions.map((s) => (
                        <li key={s}>
                          <button
                            className={`w-full text-left btn btn-ghost justify-start ${stateColorMap[s] ?? ''}`}
                            disabled={savingStateId === p.id}
                            onClick={() => changeState(p.id, s)}
                          >
                            <span className={`badge ${stateColorMap[s] ?? 'badge-ghost'} mr-2`}>{s}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </td>
                <td className="flex items-center gap-2">
                  <Link href={`/products/${p.id}/edit`} className="btn btn-sm btn-soft">
                    <svg width="800px" height="800px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-6"><path fillRule="evenodd" clipRule="evenodd" d="m3.99 16.854-1.314 3.504a.75.75 0 0 0 .966.965l3.503-1.314a3 3 0 0 0 1.068-.687L18.36 9.175s-.354-1.061-1.414-2.122c-1.06-1.06-2.122-1.414-2.122-1.414L4.677 15.786a3 3 0 0 0-.687 1.068zm12.249-12.63 1.383-1.383c.248-.248.579-.406.925-.348.487.08 1.232.322 1.934 1.025.703.703.945 1.447 1.025 1.934.058.346-.1.677-.348.925L19.774 7.76s-.353-1.06-1.414-2.12c-1.06-1.062-2.121-1.415-2.121-1.415z" /></svg>
                  </Link>
                  <button
                    className="btn btn-sm btn-soft btn-error"
                    onClick={() => deleteProduct(p.id)}
                    disabled={deletingId === p.id}
                    aria-disabled={deletingId === p.id}
                    title="Eliminar producto"
                  >
                    {deletingId === p.id ?
                      <>
                        <span className="loading loading-bars loading-xs"></span>
                      </>
                      :
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                          <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                        </svg>
                      </>
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* <div className="join mt-4">
          <button className="join-item btn">«</button>
          <button className="join-item btn btn-active">1</button>
          <button className="join-item btn">2</button>
          <button className="join-item btn">»</button>
        </div> */}
      </div>
    </div>
  )
}
