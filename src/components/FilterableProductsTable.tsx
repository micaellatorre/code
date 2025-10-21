"use client"

import { useMemo, useState } from 'react'
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
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [conditionFilter, setConditionFilter] = useState<string>('')

  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean) as string[])), [products])
  const conditions = useMemo(() => Array.from(new Set(products.map((p) => p.condition).filter(Boolean) as string[])), [products])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const model = p.modelName ?? ''
      const matchesSearch = q ? model.toLowerCase().includes(q) : true
      const matchesBrand = brandFilter ? p.brand === brandFilter : true
      const matchesCondition = conditionFilter ? p.condition === conditionFilter : true
      return matchesSearch && matchesBrand && matchesCondition
    })
  }, [search, brandFilter, conditionFilter, products])

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
              <th>Marca</th>
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
                <td>{p.brand ?? '-'}</td>
                <td>{p.capacityGB ?? '-'}</td>
                <td>{p.condition ?? '-'}</td>
                <td>{formatDecimal((p as any).costPrice)}</td>
                <td>{formatDecimal((p as any).salePrice)}</td>
                <td>{p.stock}</td>
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
