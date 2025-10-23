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
  modelName: string
  capacityGB: number | null
  condition: string | null
  color: string | null
  batteryPct: number | null
  purchaseDate: string | null
  costPrice: string | null
  salePrice: string | null
  shippingCost: string | null
  status: string
  stock: number
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
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editingStockValue, setEditingStockValue] = useState<string>('')
  const [savingStockId, setSavingStockId] = useState<string | null>(null)

  const brands = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.brand).filter(Boolean) as string[])), [productsLocal])
  const conditions = useMemo(() => Array.from(new Set(productsLocal.map((p) => p.condition).filter(Boolean) as string[])), [productsLocal])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return productsLocal.filter((p) => {
      const model = p.modelName ?? ''
      const matchesSearch = q ? model.toLowerCase().includes(q) : true
      const matchesBrand = brandFilter ? p.brand === brandFilter : true
      const matchesCondition = conditionFilter ? p.condition === conditionFilter : true
      return matchesSearch && matchesBrand && matchesCondition
    })
  }, [search, brandFilter, conditionFilter, productsLocal])

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <SearchBar placeholder="Buscar por modelo..." onSearch={setSearch} />

        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="select select-bordered w-full max-w-xs"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b ?? ''} value={b ?? ''}>
              {b ?? '-'}
            </option>
          ))}
        </select>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="select select-bordered w-full max-w-xs"
        >
          <option value="">Todas las condiciones</option>
          {conditions.map((c) => (
            <option key={c ?? ''} value={c ?? ''}>
              {c ?? '-'}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Bateria %</th>
              <th>Color</th>
              <th>Capacidad (GB)</th>
              <th>Condición</th>
              <th>Costo (USD)</th>
              <th>Precio Venta (USD)</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id}>
                <td>{p.modelName}</td>
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
                <td>{p.condition ?? '-'}</td>
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={cancelEditStock}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
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
                  <Link href={`/products/${p.id}/edit`} className="btn btn-sm btn-outline link-primary">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="join mt-4">
          <button className="join-item btn">«</button>
          <button className="join-item btn btn-active">1</button>
          <button className="join-item btn">2</button>
          <button className="join-item btn">»</button>
        </div>
      </div>
    </div>
  )
}
