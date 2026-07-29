'use client'

import type { SaleItemDraft } from '@/components/sales/types'
import ImeiDisplay from '@/components/common/ImeiDisplay'
import type { Role } from '@/lib/auth/roles'
import type { Product, ProductType, ProductStatus } from '@prisma/client'
import { ChevronDownIcon, PencilIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'

interface ProductSelectionModalProps {
  existingItems: SaleItemDraft[]
  branchId?: string | null
  saleType?: 'MINORISTA' | 'MAYORISTA'
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
  wholesalePrice: string | null
  shippingCost: string | null
  catalogModelId: string | null
  catalogCapacityId: string | null
  catalogColorId: string | null
  state: string
  senado: boolean
  senadoAt: string | null
  status: string
  stockInitial: number
  stock: number
  stockAvailable: number
  location: string | null
  notes: string | null
  origin: string | null
  createdAt: string | null
  updatedAt: string | null
}

type ApiResponse = {
  products: ApiProduct[]
  nextCursor: string | null
  totalProducts?: number
}

type ProductCluster = {
  key: string
  product: ApiProduct
  products: ApiProduct[]
  stockParts: number[]
  totalStock: number
}

type AccessorySuggestion = {
  catalogModelId: string
  modelName: string
  stockAvailable: number
  suggestedUnitPrice: string
  productIds: string[]
  products: ApiProduct[]
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
    costPrice: p.costPrice != null ? (p.costPrice as any) : null,
    salePrice: p.salePrice != null ? (p.salePrice as any) : null,
    wholesalePrice: p.wholesalePrice != null ? (p.wholesalePrice as any) : null,
    shippingCost: p.shippingCost != null ? (p.shippingCost as any) : null,
    catalogModelId: p.catalogModelId,
    catalogCapacityId: p.catalogCapacityId,
    catalogColorId: p.catalogColorId,

    state: p.state as any,
    senado: p.senado,
    senadoAt: p.senadoAt ? new Date(p.senadoAt) : null,
    status: p.status as ProductStatus,

    stockInitial: p.stockInitial ?? 0,
    stock: p.stock ?? 0,
    stockAvailable: p.stockAvailable ?? 0,

    location: p.location,
    notes: p.notes,
    origin: p.origin,

    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  } as any
}

// selection stores a representative Prisma Product, then expands to real product rows on confirm.
type SelectionDraft = Omit<SaleItemDraft, '_id' | 'product'> & { product: Product; products: ApiProduct[] }
type StateFilter = 'EN_STOCK' | 'EN_CAMINO' | 'TODOS'

function getStateBadgeClass(state: string) {
  if (state === 'EN_STOCK' || state === 'DISPONIBLE') return 'badge-success'
  if (state === 'EN_CAMINO') return 'badge-info'
  if (state === 'VENDIDO' || state === 'FUERA_DE_STOCK') return 'badge-error'
  return 'badge-ghost'
}

function productClusterKey(product: ApiProduct) {
  const imei = product.imei?.trim()
  if (imei) return `product:${product.id}`

  return [
    'cluster',
    product.type,
    product.modelName.trim().toUpperCase(),
    product.capacityGB ?? '',
    product.condition ?? '',
    product.color ?? '',
    product.batteryPct ?? '',
    product.state,
    product.salePrice ?? '',
  ].join('|')
}

function newClientLineId(prefix = 'line') {
  return `${prefix}-${crypto.randomUUID()}`
}

export default function ProductSelectionModal({ existingItems, branchId, saleType = 'MINORISTA', onClose, onAddItems }: ProductSelectionModalProps) {
  const { data: session } = useSession()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const canOpenProductEdit = activeRole === 'ADMIN' || activeRole === 'STOCK' || activeRole === 'VENDEDOR'
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'ALL'>('ALL')
  const [stateFilter, setStateFilter] = useState<StateFilter>('EN_STOCK')
  const [orderBy, setOrderBy] = useState<'alpha_asc' | 'alpha_desc' | 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc'>('alpha_asc')
  const [selection, setSelection] = useState<Record<string, SelectionDraft>>({})
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({})
  const [isSelectionCartExpanded, setIsSelectionCartExpanded] = useState(false)
  const [suggestionsByPhoneId, setSuggestionsByPhoneId] = useState<Record<string, AccessorySuggestion[]>>({})
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 80

  const requestSeq = useRef(0)

  const buildUrl = (q: string, type: ProductType | 'ALL', state: StateFilter, cursor?: string | null) => {
    const params = new URLSearchParams()
    params.set('state', state)
    params.set('senado', 'false')
    params.set('limit', String(LIMIT))
    if (q.trim()) params.set('q', q.trim())
    if (type !== 'ALL') params.set('type', type)
    if (cursor) params.set('cursor', cursor)
    params.set('orderBy', orderBy)
    params.set('saleType', saleType)
    return `/api/products?${params.toString()}`
  }

  const fetchProducts = useCallback(async (q: string, type: ProductType | 'ALL', state: StateFilter) => {
    setIsLoading(true)
    const seq = ++requestSeq.current

    try {
      const res = await fetch(buildUrl(q, type, state), { cache: 'no-store' })
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
  }, [orderBy])

  const fetchMore = async () => {
    if (!nextCursor) return
    setIsLoading(true)
    const seq = ++requestSeq.current

    try {
      const res = await fetch(buildUrl(query, typeFilter, stateFilter, nextCursor), { cache: 'no-store' })
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

  const debouncedFetch = useMemo(() => debounce(fetchProducts, 300), [fetchProducts])
  useEffect(() => {
    debouncedFetch(query, typeFilter, stateFilter)
  }, [query, typeFilter, stateFilter, orderBy, debouncedFetch])

  const getAvailableStockForProduct = useCallback((product: Pick<ApiProduct, 'id' | 'stockAvailable' | 'stock'>) => {
    const existingUnits = existingItems
      .filter((item) => item.productId === product.id)
      .reduce((sum, item) => sum + item.units, 0)

    return Math.max(0, (product.stockAvailable ?? product.stock ?? 0) - existingUnits)
  }, [existingItems])

  const availableStock = useMemo(() => {
    const stockMap = new Map<string, number>()
    products.forEach((p) => stockMap.set(p.id, getAvailableStockForProduct(p)))

    return stockMap
  }, [products, getAvailableStockForProduct])

  const productClusters = useMemo<ProductCluster[]>(() => {
    const clusterMap = new Map<string, ApiProduct[]>()

    for (const product of products) {
      const key = productClusterKey(product)
      clusterMap.set(key, [...(clusterMap.get(key) ?? []), product])
    }

    return Array.from(clusterMap.entries()).map(([key, clusterProducts]) => {
      const stockParts = clusterProducts.map((product) => Math.max(0, availableStock.get(product.id) ?? 0))
      return {
        key,
        product: clusterProducts[0],
        products: clusterProducts,
        stockParts,
        totalStock: stockParts.reduce((sum, stock) => sum + stock, 0),
      }
    })
  }, [products, availableStock])

  useEffect(() => {
    const phoneIds = productClusters
      .filter((cluster) => cluster.product.type === 'PHONE')
      .map((cluster) => cluster.product.id)

    if (!phoneIds.length) {
      setSuggestionsByPhoneId({})
      return
    }

    const controller = new AbortController()
    setSuggestionsLoading(true)
    const params = new URLSearchParams()
    params.set('phoneProductIds', phoneIds.join(','))
    params.set('saleType', saleType)
    if (branchId) params.set('branchId', branchId)

    fetch(`/api/sales/accessory-suggestions?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => setSuggestionsByPhoneId(body?.suggestionsByPhoneProductId ?? {}))
      .catch((error) => {
        if (error?.name !== 'AbortError') setSuggestionsByPhoneId({})
      })
      .finally(() => {
        if (!controller.signal.aborted) setSuggestionsLoading(false)
      })

    return () => controller.abort()
  }, [branchId, productClusters, saleType])

  const unavailableCount = useMemo(
    () => productClusters.filter((cluster) => cluster.totalStock <= 0 && !selection[cluster.key]).length,
    [productClusters, selection],
  )

  const selectedEntries = useMemo(() => Object.entries(selection), [selection])
  const selectedUnits = useMemo(
    () => selectedEntries.reduce((sum, [, draft]) => sum + draft.units, 0),
    [selectedEntries],
  )

  const toggleCluster = (clusterKey: string) => {
    setExpandedClusters((prev) => ({ ...prev, [clusterKey]: !prev[clusterKey] }))
  }

  const removeSelection = (clusterKey: string) => {
    setSelection((prev) => {
      const next = { ...prev }
      delete next[clusterKey]
      return next
    })
  }

  const handleToggleSelection = (cluster: ProductCluster, isSelected: boolean) => {
    const product = cluster.product
    const newSelection = { ...selection }
    if (isSelected) {
      const prismaProduct = apiToPrismaProduct(product)

      newSelection[cluster.key] = {
        clientLineId: newClientLineId('product'),
        parentClientLineId: null,
        productId: prismaProduct.id,
        product: prismaProduct,
        products: cluster.products,
        units: 1,
        unitPrice: product.salePrice ?? '0',
        unitCost: product.costPrice ?? '0',
        extraCost: '0',
        kind: prismaProduct.type === 'PHONE' ? 'NORMAL' : 'NORMAL',
      }
    } else {
      delete newSelection[cluster.key]
    }
    setSelection(newSelection)
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  const getPhoneLineId = (cluster: ProductCluster) => {
    const selected = selection[cluster.key]
    if (selected) return selected.clientLineId

    const clusterProductIds = new Set(cluster.products.map((product) => product.id))
    return existingItems.find((item) => clusterProductIds.has(item.productId))?.clientLineId ?? null
  }

  const getSuggestionSelected = (suggestion: AccessorySuggestion, parentClientLineId: string | null) => {
    if (!parentClientLineId) return false
    return [
      ...Object.values(selection),
      ...existingItems,
    ].some((item) =>
      item.parentClientLineId === parentClientLineId &&
      suggestion.productIds.includes(item.productId)
    )
  }

  const getSuggestionAvailableStock = (suggestion: AccessorySuggestion) => {
    const used = [...Object.values(selection), ...existingItems]
      .filter((item) => suggestion.productIds.includes(item.productId))
      .reduce((sum, item) => sum + item.units, 0)
    return Math.max(0, suggestion.stockAvailable - used)
  }

  const addSuggestedAccessory = (event: MouseEvent<HTMLButtonElement>, cluster: ProductCluster, suggestion: AccessorySuggestion) => {
    event.stopPropagation()

    const parentClientLineId = getPhoneLineId(cluster)
    if (!parentClientLineId) {
      showToast('Agrega primero el equipo para asociar este accesorio.')
      return
    }

    const available = getSuggestionAvailableStock(suggestion)
    if (available <= 0) {
      showToast('Sin stock disponible para ese accesorio.')
      return
    }

    const key = `suggestion:${parentClientLineId}:${suggestion.catalogModelId}`
    const existing = selection[key]
    if (existing) {
      setSelection((prev) => ({
        ...prev,
        [key]: { ...existing, units: Math.min(existing.units + 1, existing.units + available) },
      }))
      return
    }

    const firstProduct = suggestion.products[0]
    if (!firstProduct) return
    const prismaProduct = apiToPrismaProduct(firstProduct)
    setSelection((prev) => ({
      ...prev,
      [key]: {
        clientLineId: newClientLineId('suggestion'),
        parentClientLineId,
        productId: prismaProduct.id,
        product: prismaProduct,
        products: suggestion.products,
        units: 1,
        unitPrice: suggestion.suggestedUnitPrice,
        unitCost: firstProduct.costPrice ?? '0',
        extraCost: '0',
        kind: 'NORMAL',
      },
    }))
  }

  const handleQuantityChange = (clusterKey: string, units: number) => {
    const draft = selection[clusterKey]
    if (!draft) return

    const cluster = productClusters.find((item) => item.key === clusterKey)
    const stock = draft
      ? draft.products.reduce((sum, product) => sum + getAvailableStockForProduct(product), 0)
      : cluster?.totalStock ?? 0
    const requestedUnits = Number.isFinite(units) ? units : 1
    const cappedUnits = Math.max(1, Math.min(requestedUnits, Math.max(1, stock)))

    setSelection((prev) => ({
      ...prev,
      [clusterKey]: { ...prev[clusterKey], units: cappedUnits },
    }))
  }

  const handleConfirm = () => {
    const timestamp = Date.now()
    const newItems: SaleItemDraft[] = Object.values(selection).flatMap((draft) => {
      let remaining = draft.units
      return draft.products.flatMap((product, index) => {
        if (remaining <= 0) return []

        const stock = getAvailableStockForProduct(product)
        const units = Math.min(remaining, stock)
        if (units <= 0) return []

        remaining -= units
        const prismaProduct = apiToPrismaProduct(product)
        return [{
          clientLineId: index === 0 ? draft.clientLineId : `${draft.clientLineId}-${product.id}-${index}`,
          parentClientLineId: draft.parentClientLineId ?? null,
          productId: prismaProduct.id,
          product: prismaProduct,
          units,
          unitPrice: product.salePrice ?? draft.unitPrice,
          unitCost: product.costPrice ?? draft.unitCost,
          extraCost: draft.extraCost,
          kind: draft.kind,
          _id: `${product.id}-${timestamp}-${index}`,
        }]
      })
    })
    if (newItems.length === 0) return

    onAddItems(newItems)
  }

  const productEditHref = (productId: string) => `/dashboard/products/${productId}/edit`

  const clusterLocationLabel = (cluster: ProductCluster) => {
    const locations = Array.from(new Set(cluster.products.map((product) => product.location?.trim()).filter(Boolean) as string[]))
    if (locations.length === 0) return '-'
    if (locations.length === 1) return locations[0]
    return `${locations.length} ubicaciones`
  }

  const productMetaLabel = (product: ApiProduct) => {
    return [
      product.color,
      product.capacityGB ? `${product.capacityGB}GB` : null,
      product.imei ? `IMEI ${product.imei}` : 'IMEI N/A',
    ].filter(Boolean).join(' · ')
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl">
        {toastMessage ? (
          <div className="toast toast-top toast-end z-[130]">
            <div className="alert alert-warning text-sm shadow-lg">
              <span>{toastMessage}</span>
            </div>
          </div>
        ) : null}
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
          <div className="join">
            <button onClick={() => setStateFilter('EN_STOCK')} className={`btn btn-sm join-item ${stateFilter === 'EN_STOCK' ? 'btn-active' : ''}`}>En stock</button>
            <button onClick={() => setStateFilter('EN_CAMINO')} className={`btn btn-sm join-item ${stateFilter === 'EN_CAMINO' ? 'btn-active' : ''}`}>En camino</button>
            <button onClick={() => setStateFilter('TODOS')} className={`btn btn-sm join-item ${stateFilter === 'TODOS' ? 'btn-active' : ''}`}>Todos</button>
          </div>
          <div className="flex flex-col items-start gap-1">
            <label className="text-xs font-medium text-base-content/60">Ordenar por</label>
            <select
              className="select select-bordered select-sm"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
            >
              <option value="alpha_asc">Alfabético A-Z</option>
              <option value="alpha_desc">Alfabético Z-A</option>
              <option value="created_desc">Más nuevos creados</option>
              <option value="created_asc">Más viejos creados</option>
              <option value="updated_desc">Más nuevos modificados</option>
              <option value="updated_asc">Más viejos modificados</option>
            </select>
          </div>
        </div>

        {selectedEntries.length > 0 ? (
          <div className="mb-4 rounded-box border border-primary/30 bg-primary/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-content">
                  <ShoppingCartIcon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary">Items seleccionados</p>
                  <p className="text-xs text-base-content/60">
                    {selectedUnits} {selectedUnits === 1 ? 'item listo' : 'items listos'} para agregar a la venta
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-outline btn-sm gap-2"
                onClick={() => setIsSelectionCartExpanded((prev) => !prev)}
              >
                {isSelectionCartExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                <ChevronDownIcon className={`size-4 transition-transform ${isSelectionCartExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedEntries.map(([clusterKey, draft]) => (
                <span key={clusterKey} className="badge badge-primary badge-outline h-auto min-h-7 max-w-full gap-1 py-1 pl-3 pr-1">
                  <span className="max-w-[18rem] truncate">
                    {draft.product.modelName}{draft.units > 1 ? ` x${draft.units}` : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle size-5 min-h-0"
                    onClick={() => removeSelection(clusterKey)}
                    aria-label={`Quitar ${draft.product.modelName}`}
                    title="Quitar seleccion"
                  >
                    <XMarkIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>

            {isSelectionCartExpanded ? (
              <div className="mt-3 overflow-x-auto rounded-box border border-primary/20 bg-base-100/80">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>IMEI</th>
                      <th>Estado</th>
                      <th>Stock disp.</th>
                      <th>% Bateria</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntries.map(([clusterKey, draft]) => {
                      const representative = draft.products[0]
                      const stock = draft.products.reduce((sum, product) => sum + getAvailableStockForProduct(product), 0)
                      const isCluster = draft.products.length > 1

                      return (
                        <tr key={clusterKey}>
                          <td>
                            <Link href={productEditHref(representative.id)} className="link link-hover link-primary font-medium">
                              {representative.modelName}
                            </Link>
                            <div className="text-xs opacity-60">
                              {representative.color || ''} {representative.capacityGB ? `${representative.capacityGB}GB` : ''}
                            </div>
                          </td>
                          <td>
                            <ImeiDisplay imei={isCluster ? null : representative.imei} fallback={isCluster ? `${draft.products.length} items` : 'N/A'} />
                          </td>
                          <td>
                            <span className={`text-nowrap badge badge-sm ${getStateBadgeClass(representative.state)}`}>
                              {representative.state.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-ghost ${stock <= 0 ? 'badge-error' : ''}`}>{stock}</span>
                          </td>
                          <td>{representative.batteryPct != null ? `${representative.batteryPct}%` : 'N/A'}</td>
                          <td>${draft.unitPrice ?? representative.salePrice ?? '0'}</td>
                          <td>
                            <input
                              type="number"
                              value={draft.units}
                              onChange={(e) => handleQuantityChange(clusterKey, parseInt(e.target.value, 10))}
                              className="input input-bordered input-xs w-20"
                              min={1}
                              max={Math.max(1, stock)}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square text-error"
                              onClick={() => removeSelection(clusterKey)}
                              title="Quitar seleccion"
                              aria-label={`Quitar ${representative.modelName}`}
                            >
                              <XMarkIcon className="size-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto h-96">
          {isLoading && products.length === 0 ? (
            <div className="flex justify-center items-center h-full"><span className="loading loading-lg"></span></div>
          ) : (
            <>
              <table className="table table-pin-rows table-sm">
                <thead>
                  <tr>
                    <th></th>
                    <th>IMEI</th>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th>Stock Disp.</th>
                    <th>Ubicación</th>
                    <th>% Batería</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productClusters.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-sm text-base-content/60">
                        No se encontraron productos para esos filtros.
                      </td>
                    </tr>
                  ) : productClusters.map((cluster) => {
                    const p = cluster.product
                    const currentStock = cluster.totalStock
                    const stockDetail = cluster.stockParts.length > 1
                      ? `${cluster.stockParts.join(' + ')} = ${cluster.totalStock}`
                      : `Stock disponible: ${cluster.totalStock}`
                    const isSelected = !!selection[cluster.key]
                    const isUnavailable = currentStock <= 0 && !isSelected
                    const isCluster = cluster.products.length > 1
                    const isExpanded = !!expandedClusters[cluster.key]
                    const suggestions = p.type === 'PHONE' ? suggestionsByPhoneId[p.id] ?? [] : []
                    const parentClientLineId = p.type === 'PHONE' ? getPhoneLineId(cluster) : null

                    return (
                      <Fragment key={cluster.key}>
                      <tr
                        className={`${isSelected ? 'bg-success/20' : ''} ${isUnavailable ? 'opacity-50' : ''}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelection(cluster, e.target.checked)}
                            className="checkbox checkbox-sm"
                            disabled={currentStock <= 0 && !isSelected}
                          />
                        </td>
                        <td>
                          <ImeiDisplay imei={isCluster ? null : p.imei} className="text-base-content/40" fallback="N/A" />
                        </td>
                        <td>
                          <div className={isCluster ? 'dropdown dropdown-hover' : ''}>
                            <Link href={productEditHref(p.id)} className="font-bold link link-hover link-primary">
                              {p.modelName}
                            </Link>
                            {isCluster ? (
                              <ul className="dropdown-content menu menu-xs z-20 mt-1 w-72 rounded-box border border-base-content/10 bg-base-100 p-2 shadow">
                                {cluster.products.map((product, index) => (
                                  <li key={product.id}>
                                    <Link href={productEditHref(product.id)} className="flex items-center justify-between gap-2">
                                      <span className="truncate">{product.modelName}</span>
                                      <span className="badge badge-ghost badge-xs">{Math.max(0, availableStock.get(product.id) ?? 0)}</span>
                                      <span className="text-xs opacity-60">#{index + 1}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="text-xs opacity-70">
                            {p.color || ''} {p.capacityGB ? `${p.capacityGB}GB` : ''}
                          </div>
                          {suggestions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-base-content/50">Sugeridos:</span>
                              {suggestions.map((suggestion) => {
                                const available = getSuggestionAvailableStock(suggestion)
                                const selected = getSuggestionSelected(suggestion, parentClientLineId)
                                const disabled = available <= 0
                                return (
                                  <button
                                    key={suggestion.catalogModelId}
                                    type="button"
                                    className={`badge h-auto min-h-6 gap-1 py-1 transition ${selected ? 'badge-primary' : disabled ? 'badge-ghost opacity-50' : 'badge-outline hover:badge-primary'}`}
                                    disabled={disabled}
                                    title={disabled ? 'Sin stock' : `Stock disponible: ${available}`}
                                    aria-label={disabled ? `${suggestion.modelName} sin stock` : `Agregar ${suggestion.modelName} a la venta`}
                                    onClick={(event) => addSuggestedAccessory(event, cluster, suggestion)}
                                  >
                                    <span>{suggestion.modelName}</span>
                                    <span aria-hidden="true">+</span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`text-nowrap badge badge-sm ${getStateBadgeClass(p.state)}`}>
                            {p.state.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="tooltip" data-tip={stockDetail}>
                            <span className={`badge badge-ghost ${isUnavailable ? 'badge-error' : ''}`}>
                              {currentStock}
                            </span>
                          </div>
                        </td>
                        <td>{clusterLocationLabel(cluster)}</td>
                        <td>{p.batteryPct != null ? `${p.batteryPct}%` : 'N/A'}</td>
                        <td>${p.salePrice ?? '0'}</td>
                        <td>
                          {isSelected ?
                            <input
                              type="number"
                              value={selection[cluster.key].units}
                              onChange={(e) => handleQuantityChange(cluster.key, parseInt(e.target.value, 10))}
                              className="input input-bordered input-xs w-20"
                              min={1}
                              max={currentStock}
                            />
                            :
                            <span className="text-center">-</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {canOpenProductEdit ? (
                              <Link href={productEditHref(p.id)} className="btn btn-ghost btn-xs btn-square" title="Editar producto" aria-label="Editar producto">
                                <PencilIcon className="size-4" />
                              </Link>
                            ) : null}
                            {isCluster ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={() => toggleCluster(cluster.key)}
                                title={isExpanded ? 'Contraer cluster' : 'Expandir cluster'}
                                aria-label={isExpanded ? 'Contraer cluster' : 'Expandir cluster'}
                              >
                                <ChevronDownIcon className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isCluster && isExpanded ? (
                        <tr>
                          <td colSpan={10} className="bg-base-200/50 p-0">
                            <div className="p-3">
                              <table className="table table-xs w-full">
                                <thead>
                                  <tr>
                                    <th>Producto</th>
                                    <th>IMEI</th>
                                    <th>Stock</th>
                                    <th>Ubicación</th>
                                    <th>Precio</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cluster.products.map((product) => (
                                    <tr key={product.id}>
                                      <td>
                                        <Link href={productEditHref(product.id)} className="link link-hover link-primary font-medium">
                                          {product.modelName}
                                        </Link>
                                        <div className="text-xs opacity-60">{productMetaLabel(product)}</div>
                                      </td>
                                      <td><ImeiDisplay imei={product.imei} fallback="N/A" /></td>
                                      <td><span className="badge badge-ghost badge-xs">{Math.max(0, availableStock.get(product.id) ?? 0)}</span></td>
                                      <td>{product.location || '-'}</td>
                                      <td>${product.salePrice ?? '0'}</td>
                                      <td className="text-right">
                                        {canOpenProductEdit ? (
                                          <Link href={productEditHref(product.id)} className="btn btn-ghost btn-xs btn-square" title="Editar producto" aria-label="Editar producto">
                                            <PencilIcon className="size-3.5" />
                                          </Link>
                                        ) : null}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between gap-2 mt-3">
                <div className="text-xs opacity-60">
                  Mostrando {productClusters.length}{hasMore ? '+' : ''} productos
                  {unavailableCount > 0 ? ` (${unavailableCount} sin stock disponible)` : ''}
                </div>
                <button className="btn btn-sm btn-outline" disabled={!hasMore || isLoading} onClick={fetchMore}>
                  {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Cargar más'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleConfirm} className="btn btn-primary" disabled={selectedEntries.length === 0}>
            Agregar {selectedUnits} {selectedUnits === 1 ? 'item' : 'items'}
          </button>
        </div>
      </div>
    </div>
  )
}
