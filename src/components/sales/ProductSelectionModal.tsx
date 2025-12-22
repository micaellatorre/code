'use client'

import { SaleItemDraft } from '@/app/sales/new/page'
import { Product, ProductType, ProductStatus, Prisma } from '@prisma/client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

interface ProductSelectionModalProps {
  existingItems: SaleItemDraft[]
  onClose: () => void
  onAddItems: (items: SaleItemDraft[]) => void
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitFor)
  }
}

// API product (DTO)
type ApiProduct = {
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
  stockInitial: number
  stock: number
  stockAvailable: number
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

type ApiResponse = {
  products: ApiProduct[]
  nextCursor: string | null
  totalProducts?: number
}

// ✅ Convert DTO -> Prisma Product (enums + Date + Decimal)
// NOTE: This is for UI state only. If you depend on Decimal methods, this can be annoying.
function apiToPrismaProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    tenantId: p.tenantId,
    type: p.type as any,
    brand: p.brand,
    imei: p.imei,
    modelName: p.modelName,
    capacityGB: p.capacityGB,
    condition: p.condition as any,
    color: p.color,
    batteryPct: p.batteryPct,
    purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : null,

    // Prisma Decimal
    costPrice: p.costPrice != null ? new Prisma.Decimal(p.costPrice) : null,
    salePrice: p.salePrice != null ? new Prisma.Decimal(p.salePrice) : null,
    shippingCost: p.shippingCost != null ? new Prisma.Decimal(p.shippingCost) : null,

    state: p.state as any,
    status: p.status as ProductStatus,

    stockInitial: p.stockInitial ?? 0,
    stock: p.stock ?? 0,
    stockAvailable: p.stockAvailable ?? 0,

    notes: p.notes,

    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  } as any
}

// selection stores Prisma Product now (to satisfy SaleItemDraft)
type SelectionDraft = Omit<SaleItemDraft, '_id' | 'product'> & { product: Product }

export default function ProductSelectionModal({ existingItems, onClose, onAddItems }: ProductSelectionModalProps) {
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'ALL'>('ALL')
  const [selection, setSelection] = useState<Record<string, SelectionDraft>>({})

  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 80

  const requestSeq = useRef(0)

  const buildUrl = (q: string, type: ProductType | 'ALL', cursor?: string | null) => {
    const params = new URLSearchParams()
    params.set('state', 'EN_STOCK')
    params.set('limit', String(LIMIT))
    if (q.trim()) params.set('q', q.trim())
    if (type !== 'ALL') params.set('type', type)
    if (cursor) params.set('cursor', cursor)
    return `/api/products?${params.toString()}`
  }

  const fetchProducts = async (q: string, type: ProductType | 'ALL') => {
    setIsLoading(true)
    const seq = ++requestSeq.current

    try {
      const res = await fetch(buildUrl(q, type), { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())

      const data: ApiResponse = await res.json()
      if (seq !== requestSeq.current) return

      setProducts(data.products ?? [])
      setNextCursor(data.nextCursor ?? null)
      setHasMore(!!data.nextCursor)
    } catch (error) {
      console.error('Failed to fetch products', error)
      setProducts([])
      setNextCursor(null)
      setHasMore(false)
    } finally {
      if (seq === requestSeq.current) setIsLoading(false)
    }
  }

  const fetchMore = async () => {
    if (!nextCursor) return
    setIsLoading(true)
    const seq = ++requestSeq.current

    try {
      const res = await fetch(buildUrl(query, typeFilter, nextCursor), { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())

      const data: ApiResponse = await res.json()
      if (seq !== requestSeq.current) return

      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const merged = [...prev]
        for (const p of data.products ?? []) {
          if (!seen.has(p.id)) merged.push(p)
        }
        return merged
      })

      setNextCursor(data.nextCursor ?? null)
      setHasMore(!!data.nextCursor)
    } catch (error) {
      console.error('Failed to fetch more products', error)
    } finally {
      if (seq === requestSeq.current) setIsLoading(false)
    }
  }

  const debouncedFetch = useCallback(debounce(fetchProducts, 300), [])
  useEffect(() => {
    debouncedFetch(query, typeFilter)
  }, [query, typeFilter, debouncedFetch])

  const availableStock = useMemo(() => {
    const stockMap = new Map<string, number>()
    products.forEach((p) => stockMap.set(p.id, p.stockAvailable ?? p.stock ?? 0))

    existingItems.forEach((item) => {
      if (stockMap.has(item.productId)) {
        stockMap.set(item.productId, (stockMap.get(item.productId) ?? 0) - item.units)
      }
    })

    return stockMap
  }, [products, existingItems])

  const handleToggleSelection = (product: ApiProduct, isSelected: boolean) => {
    const newSelection = { ...selection }
    if (isSelected) {
      const prismaProduct = apiToPrismaProduct(product)

      newSelection[product.id] = {
        productId: prismaProduct.id,
        product: prismaProduct,
        units: 1,
        unitPrice: product.salePrice ?? '0',
        unitCost: product.costPrice ?? '0',
        extraCost: '0',
        kind: prismaProduct.type === 'PHONE' ? 'NORMAL' : 'NORMAL',
      }
    } else {
      delete newSelection[product.id]
    }
    setSelection(newSelection)
  }

  const handleQuantityChange = (productId: string, units: number) => {
    const stock = availableStock.get(productId) || 0
    const cappedUnits = Math.max(1, Math.min(units, stock))
    setSelection((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], units: cappedUnits },
    }))
  }

  const handleConfirm = () => {
    const newItems: SaleItemDraft[] = Object.values(selection).map((draft) => ({
      ...draft,
      _id: `${draft.productId}-${Date.now()}`,
    }))
    onAddItems(newItems)
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">X</button>
        <h3 className="font-bold text-lg">Agregar Items a la Venta</h3>

        <div className="flex flex-wrap gap-2 items-center my-4 p-2 bg-base-200 rounded-box">
          <input
            type="text"
            placeholder="Buscar por modelo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input input-bordered input-sm flex-grow"
          />
          <div className="join">
            <button onClick={() => setTypeFilter('ALL')} className={`btn btn-sm join-item ${typeFilter === 'ALL' ? 'btn-active' : ''}`}>Todos</button>
            <button onClick={() => setTypeFilter('PHONE')} className={`btn btn-sm join-item ${typeFilter === 'PHONE' ? 'btn-active' : ''}`}>Teléfonos</button>
            <button onClick={() => setTypeFilter('ACCESSORY')} className={`btn btn-sm join-item ${typeFilter === 'ACCESSORY' ? 'btn-active' : ''}`}>Accesorios</button>
          </div>
        </div>

        <div className="overflow-x-auto h-96">
          {isLoading && products.length === 0 ? (
            <div className="flex justify-center items-center h-full"><span className="loading loading-lg"></span></div>
          ) : (
            <>
              <table className="table table-pin-rows table-sm">
                <thead>
                  <tr>
                    <th></th>
                    <th>Producto</th>
                    <th>Stock Disp.</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const currentStock = availableStock.get(p.id) || 0
                    const isSelected = !!selection[p.id]
                    if (currentStock <= 0 && !isSelected) return null

                    return (
                      <tr key={p.id} className={isSelected ? 'bg-success/20' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelection(p, e.target.checked)}
                            className="checkbox checkbox-sm"
                            disabled={currentStock <= 0 && !isSelected}
                          />
                        </td>
                        <td>
                          <div className="font-bold">{p.modelName}</div>
                          <div className="text-xs opacity-70">
                            {p.color || ''} {p.capacityGB ? `${p.capacityGB}GB` : ''}
                          </div>
                        </td>
                        <td><span className="badge badge-ghost">{currentStock}</span></td>
                        <td>
                          {isSelected && (
                            <input
                              type="number"
                              value={selection[p.id].units}
                              onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value))}
                              className="input input-bordered input-xs w-20"
                              min={1}
                              max={currentStock}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between gap-2 mt-3">
                <div className="text-xs opacity-60">Mostrando {products.length}{hasMore ? '+' : ''} productos</div>
                <button className="btn btn-sm btn-outline" disabled={!hasMore || isLoading} onClick={fetchMore}>
                  {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Cargar más'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleConfirm} className="btn btn-primary" disabled={Object.keys(selection).length === 0}>
            Agregar {Object.keys(selection).length} Items
          </button>
        </div>
      </div>
    </div>
  )
}
