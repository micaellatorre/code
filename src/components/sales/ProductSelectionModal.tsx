'use client'

import type { SaleItemDraft } from '@/components/sales/types'
import ImeiDisplay from '@/components/common/ImeiDisplay'
import type { Role } from '@/lib/auth/roles'
import type { Product, ProductType, ProductStatus } from '@prisma/client'
import ProductColorSwatch from '@/components/products/ProductColorSwatch'
import {
  getProductDisplayCapacity,
  getProductDisplayColor,
  getProductDisplayColorHex,
  getProductDisplayModel,
  type ProductCatalogDisplayCapacity,
  type ProductCatalogDisplayColor,
  type ProductCatalogDisplayModel,
  type ProductCatalogDisplayProduct,
} from '@/lib/products/display'
import { ChevronDownIcon, PencilIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'

interface ProductSelectionModalProps {
  existingItems: SaleItemDraft[]
  branchId?: string | null
  saleType?: 'MINORISTA' | 'MAYORISTA'
  preselectDefaultBag?: boolean
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
  catalogModel?: ProductCatalogDisplayModel | null
  catalogCapacity?: ProductCatalogDisplayCapacity | null
  catalogColor?: ProductCatalogDisplayColor | null
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
function apiToPrismaProduct(p: ApiProduct): Product & ProductCatalogDisplayProduct {
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
    catalogModel: p.catalogModel ?? null,
    catalogCapacity: p.catalogCapacity ?? null,
    catalogColor: p.catalogColor ?? null,

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
type SelectionDraft = Omit<SaleItemDraft, '_id' | 'product'> & {
  product: Product & ProductCatalogDisplayProduct
  products: ApiProduct[]
  existingId?: string
}
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
    getProductDisplayModel(product).trim().toUpperCase(),
    getProductDisplayCapacity(product) ?? '',
    product.condition ?? '',
    getProductDisplayColor(product) ?? '',
    product.batteryPct ?? '',
    product.state,
    product.salePrice ?? '',
  ].join('|')
}

function productSelectionKey(product: Pick<ApiProduct, 'id'>) {
  return `product:${product.id}`
}

function toNullableIsoString(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
}

function toNullableString(value: unknown) {
  if (value == null) return null
  return String(value)
}

function toNullableNumber(value: unknown) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStockNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function productToApiProduct(product: SaleItemDraft['product'], fallbackProductId: string, minimumStock = 0): ApiProduct {
  const raw = product as any
  const stockAvailable = Math.max(toStockNumber(raw.stockAvailable ?? raw.stock, 0), minimumStock)
  const stock = Math.max(toStockNumber(raw.stock ?? raw.stockAvailable, stockAvailable), minimumStock)
  const stockInitial = Math.max(toStockNumber(raw.stockInitial ?? raw.stock ?? raw.stockAvailable, stock), stock, stockAvailable)

  return {
    id: String(raw.id ?? fallbackProductId),
    tenantId: String(raw.tenantId ?? ''),
    type: String(raw.type ?? 'ACCESSORY'),
    brand: raw.brand ?? null,
    imei: raw.imei ?? null,
    modelName: String(raw.modelName ?? raw.catalogModel?.name ?? 'Producto'),
    capacityGB: toNullableNumber(raw.capacityGB),
    condition: raw.condition ?? null,
    color: raw.color ?? null,
    batteryPct: toNullableNumber(raw.batteryPct),
    purchaseDate: toNullableIsoString(raw.purchaseDate),
    costPrice: toNullableString(raw.costPrice),
    salePrice: toNullableString(raw.salePrice),
    wholesalePrice: toNullableString(raw.wholesalePrice),
    shippingCost: toNullableString(raw.shippingCost),
    catalogModelId: raw.catalogModelId ?? raw.catalogModel?.id ?? null,
    catalogCapacityId: raw.catalogCapacityId ?? raw.catalogCapacity?.id ?? null,
    catalogColorId: raw.catalogColorId ?? raw.catalogColor?.id ?? null,
    catalogModel: raw.catalogModel ?? null,
    catalogCapacity: raw.catalogCapacity ?? null,
    catalogColor: raw.catalogColor ?? null,
    state: String(raw.state ?? 'EN_STOCK'),
    senado: Boolean(raw.senado ?? false),
    senadoAt: toNullableIsoString(raw.senadoAt),
    status: String(raw.status ?? 'AVAILABLE'),
    stockInitial,
    stock,
    stockAvailable,
    location: raw.location ?? null,
    notes: raw.notes ?? null,
    origin: raw.origin ?? null,
    createdAt: toNullableIsoString(raw.createdAt),
    updatedAt: toNullableIsoString(raw.updatedAt),
  }
}

function isBagProduct(product: ApiProduct | (Product & ProductCatalogDisplayProduct)) {
  return getProductDisplayModel(product).trim().toLowerCase() === 'bolsa'
}

function defaultBagSelectionKey(product: ApiProduct) {
  return `default-bag:${product.catalogModelId ?? product.id}`
}

function existingItemSelectionKey(item: SaleItemDraft, product: ApiProduct) {
  if (item.parentClientLineId && product.catalogModelId) return `suggestion:${item.parentClientLineId}:${product.catalogModelId}`
  if (item.parentClientLineId) return `existing:${item.clientLineId}`
  return productSelectionKey(product)
}

function buildProductSelectionDraft(product: ApiProduct, products: ApiProduct[] = [product]): SelectionDraft {
  const prismaProduct = apiToPrismaProduct(product)

  return {
    clientLineId: newClientLineId('product'),
    parentClientLineId: null,
    productId: prismaProduct.id,
    product: prismaProduct,
    products,
    units: 1,
    unitPrice: product.salePrice ?? '0',
    unitCost: product.costPrice ?? '0',
    extraCost: '0',
    kind: 'NORMAL',
  }
}

function removeSelectionKeys(prev: Record<string, SelectionDraft>, keysToRemove: Iterable<string>) {
  const next = { ...prev }
  const removedClientLineIds = new Set<string>()

  for (const key of keysToRemove) {
    const removed = next[key]
    delete next[key]
    if (removed?.clientLineId) removedClientLineIds.add(removed.clientLineId)
  }

  if (removedClientLineIds.size > 0) {
    for (const [key, draft] of Object.entries(next)) {
      if (draft.parentClientLineId && removedClientLineIds.has(draft.parentClientLineId)) delete next[key]
    }
  }

  return next
}

function getSelectionKeyForProductFromSelection(selection: Record<string, SelectionDraft>, product: ApiProduct) {
  const exactKey = productSelectionKey(product)
  if (selection[exactKey]) return exactKey

  return Object.entries(selection).find(([, draft]) => (
    !draft.parentClientLineId &&
    (draft.productId === product.id || draft.products.some((draftProduct) => draftProduct.id === product.id))
  ))?.[0] ?? null
}

function getSelectionKeysForClusterFromSelection(selection: Record<string, SelectionDraft>, cluster: ProductCluster) {
  const selectedKeys = new Set<string>()
  if (selection[cluster.key]) selectedKeys.add(cluster.key)

  for (const product of cluster.products) {
    const selectedKey = getSelectionKeyForProductFromSelection(selection, product)
    if (selectedKey) selectedKeys.add(selectedKey)
  }

  return Array.from(selectedKeys)
}

function buildAllocatedProductDraft(product: ApiProduct, units: number, existingDraft?: SelectionDraft) {
  const prismaProduct = apiToPrismaProduct(product)

  return {
    ...(existingDraft ?? buildProductSelectionDraft(product)),
    productId: prismaProduct.id,
    product: prismaProduct,
    products: [product],
    units,
  }
}

function buildInitialSelection(existingItems: SaleItemDraft[]) {
  const initialSelection: Record<string, SelectionDraft> = {}

  for (const item of existingItems) {
    const apiProduct = productToApiProduct(item.product, item.productId, item.units)
    const prismaProduct = apiToPrismaProduct(apiProduct)
    const key = existingItemSelectionKey(item, apiProduct)
    const selectionKey = initialSelection[key] ? `${key}:${item.clientLineId}` : key

    initialSelection[selectionKey] = {
      clientLineId: item.clientLineId,
      parentClientLineId: item.parentClientLineId ?? null,
      productId: prismaProduct.id,
      product: prismaProduct,
      products: [apiProduct],
      units: Math.max(1, item.units),
      unitPrice: item.unitPrice ?? apiProduct.salePrice ?? '0',
      unitCost: item.unitCost ?? apiProduct.costPrice ?? '0',
      extraCost: item.extraCost ?? '0',
      kind: item.kind ?? 'NORMAL',
      existingId: item._id,
    }
  }

  return initialSelection
}

function newClientLineId(prefix = 'line') {
  return `${prefix}-${crypto.randomUUID()}`
}

export default function ProductSelectionModal({ existingItems, branchId, saleType = 'MINORISTA', preselectDefaultBag = false, onClose, onAddItems }: ProductSelectionModalProps) {
  const { data: session } = useSession()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const canOpenProductEdit = activeRole === 'ADMIN' || activeRole === 'STOCK' || activeRole === 'VENDEDOR'
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'ALL'>('ALL')
  const [stateFilter, setStateFilter] = useState<StateFilter>('EN_STOCK')
  const [orderBy, setOrderBy] = useState<'alpha_asc' | 'alpha_desc' | 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc'>('alpha_asc')
  const [selection, setSelection] = useState<Record<string, SelectionDraft>>(() => buildInitialSelection(existingItems))
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({})
  const [primaryClusterProductByKey, setPrimaryClusterProductByKey] = useState<Record<string, string>>({})
  const [isSelectionCartExpanded, setIsSelectionCartExpanded] = useState(false)
  const [suggestionsByPhoneId, setSuggestionsByPhoneId] = useState<Record<string, AccessorySuggestion[]>>({})
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [defaultBagDismissed, setDefaultBagDismissed] = useState(false)

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

  const getAvailableStockForProduct = useCallback((product: Pick<ApiProduct, 'stockAvailable' | 'stock'>) => {
    return Math.max(0, product.stockAvailable ?? product.stock ?? 0)
  }, [])

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

  const getSelectionKeyForProduct = useCallback((product: ApiProduct) => {
    return getSelectionKeyForProductFromSelection(selection, product)
  }, [selection])

  const getSelectionKeysForCluster = useCallback((cluster: ProductCluster) => {
    return getSelectionKeysForClusterFromSelection(selection, cluster)
  }, [selection])

  const getSelectionKeyForCluster = useCallback((cluster: ProductCluster) => {
    return getSelectionKeysForCluster(cluster)[0] ?? null
  }, [getSelectionKeysForCluster])

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
    () => productClusters.filter((cluster) => cluster.totalStock <= 0 && getSelectionKeysForCluster(cluster).length === 0).length,
    [getSelectionKeysForCluster, productClusters],
  )

  const selectedEntries = useMemo(() => Object.entries(selection), [selection])
  const selectedUnits = useMemo(
    () => selectedEntries.reduce((sum, [, draft]) => sum + draft.units, 0),
    [selectedEntries],
  )
  const hasBagSelected = useMemo(
    () => selectedEntries.some(([, draft]) => isBagProduct(draft.product)),
    [selectedEntries],
  )

  useEffect(() => {
    if (!preselectDefaultBag || defaultBagDismissed || hasBagSelected) return

    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('q', 'Bolsa')
    params.set('type', 'ACCESSORY')
    params.set('state', 'EN_STOCK')
    params.set('senado', 'false')
    params.set('limit', '20')
    params.set('saleType', saleType)

    fetch(`/api/products?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((body: ApiResponse | null) => {
        if (controller.signal.aborted) return

        const defaultBag = (body?.products ?? []).find((product) => (
          isBagProduct(product) && getAvailableStockForProduct(product) > 0
        ))
        if (!defaultBag) return

        setSelection((prev) => {
          if (Object.values(prev).some((draft) => isBagProduct(draft.product))) return prev

          const prismaProduct = apiToPrismaProduct(defaultBag)
          const key = defaultBagSelectionKey(defaultBag)

          return {
            ...prev,
            [key]: {
              clientLineId: newClientLineId('bag'),
              parentClientLineId: null,
              productId: prismaProduct.id,
              product: prismaProduct,
              products: [defaultBag],
              units: 1,
              unitPrice: defaultBag.salePrice ?? '0',
              unitCost: defaultBag.costPrice ?? '0',
              extraCost: '0',
              kind: 'NORMAL',
            },
          }
        })
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Failed to preselect default bag', error)
      })

    return () => controller.abort()
  }, [defaultBagDismissed, getAvailableStockForProduct, hasBagSelected, preselectDefaultBag, saleType])

  const toggleCluster = (clusterKey: string) => {
    setExpandedClusters((prev) => ({ ...prev, [clusterKey]: !prev[clusterKey] }))
  }

  const allocateAccessoryClusterSelection = useCallback((
    prev: Record<string, SelectionDraft>,
    cluster: ProductCluster,
    primaryProduct: ApiProduct,
    requestedUnits: number,
  ) => {
    const totalStock = cluster.products.reduce((sum, product) => sum + getAvailableStockForProduct(product), 0)
    const keysToRemove = getSelectionKeysForClusterFromSelection(prev, cluster)
    if (totalStock <= 0) return removeSelectionKeys(prev, keysToRemove)

    const previousDraftByProductId = new Map<string, SelectionDraft>()
    for (const product of cluster.products) {
      const selectedKey = getSelectionKeyForProductFromSelection(prev, product)
      if (selectedKey && selectedKey !== cluster.key && prev[selectedKey]) {
        previousDraftByProductId.set(product.id, prev[selectedKey])
      }
    }

    let next = removeSelectionKeys(prev, keysToRemove)
    let remainingUnits = Math.max(1, Math.min(Number.isFinite(requestedUnits) ? requestedUnits : 1, totalStock))
    const orderedProducts = [
      primaryProduct,
      ...cluster.products.filter((product) => product.id !== primaryProduct.id),
    ]

    for (const product of orderedProducts) {
      const stock = getAvailableStockForProduct(product)
      if (stock <= 0) continue

      const units = Math.min(remainingUnits, stock)
      if (units <= 0) continue

      next[productSelectionKey(product)] = buildAllocatedProductDraft(product, units, previousDraftByProductId.get(product.id))
      remainingUnits -= units
      if (remainingUnits <= 0) break
    }

    return next
  }, [getAvailableStockForProduct])

  const removeSelection = (clusterKey: string) => {
    const removed = selection[clusterKey]
    if (removed && isBagProduct(removed.product)) setDefaultBagDismissed(true)

    setSelection((prev) => removeSelectionKeys(prev, [clusterKey]))
  }

  const handleToggleSelection = (cluster: ProductCluster, isSelected: boolean) => {
    const product = cluster.product
    const isAccessoryCluster = cluster.products.length > 1 && product.type === 'ACCESSORY'

    if (isSelected) {
      if (isAccessoryCluster) {
        setExpandedClusters((prev) => ({ ...prev, [cluster.key]: true }))

        const firstAvailableProduct = cluster.products.find((item) => getAvailableStockForProduct(item) > 0)
        if (!firstAvailableProduct) return
        if (isBagProduct(firstAvailableProduct)) setDefaultBagDismissed(false)
        setPrimaryClusterProductByKey((prev) => ({ ...prev, [cluster.key]: firstAvailableProduct.id }))

        setSelection((prev) => allocateAccessoryClusterSelection(prev, cluster, firstAvailableProduct, 1))
        return
      }

      if (isBagProduct(product)) setDefaultBagDismissed(false)

      const key = cluster.products.length === 1 ? productSelectionKey(product) : cluster.key
      setSelection((prev) => ({
        ...prev,
        [key]: buildProductSelectionDraft(product, cluster.products),
      }))
    } else {
      const keysToRemove = getSelectionKeysForCluster(cluster)
      if (keysToRemove.some((key) => {
        const removed = selection[key]
        return removed && isBagProduct(removed.product)
      })) {
        setDefaultBagDismissed(true)
      }
      setPrimaryClusterProductByKey((prev) => {
        const next = { ...prev }
        delete next[cluster.key]
        return next
      })
      setSelection((prev) => removeSelectionKeys(prev, keysToRemove))
    }
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  const getPhoneLineId = (cluster: ProductCluster) => {
    const selectedKey = getSelectionKeyForCluster(cluster)
    if (selectedKey) return selection[selectedKey]?.clientLineId ?? null

    const clusterProductIds = new Set(cluster.products.map((product) => product.id))
    return existingItems.find((item) => clusterProductIds.has(item.productId))?.clientLineId ?? null
  }

  const getSuggestionSelected = (suggestion: AccessorySuggestion, parentClientLineId: string | null) => {
    if (!parentClientLineId) return false
    return Object.values(selection).some((item) =>
      item.parentClientLineId === parentClientLineId &&
      suggestion.productIds.includes(item.productId)
    )
  }

  const getSuggestionAvailableStock = (suggestion: AccessorySuggestion) => {
    const used = Object.values(selection)
      .filter((item) => suggestion.productIds.includes(item.productId))
      .reduce((sum, item) => sum + item.units, 0)
    return Math.max(0, suggestion.stockAvailable - used)
  }

  const addSuggestedAccessoryToSelection = (parentClientLineId: string | null, suggestion: AccessorySuggestion, options?: { silent?: boolean }) => {
    if (!parentClientLineId) {
      if (!options?.silent) showToast('Agrega primero el equipo para asociar este accesorio.')
      return
    }

    const available = getSuggestionAvailableStock(suggestion)
    if (available <= 0) {
      if (!options?.silent) showToast('Sin stock disponible para ese accesorio.')
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

  const addSuggestedAccessory = (event: MouseEvent<HTMLButtonElement>, cluster: ProductCluster, suggestion: AccessorySuggestion) => {
    event.stopPropagation()
    addSuggestedAccessoryToSelection(getPhoneLineId(cluster), suggestion)
  }

  const addAccessoryUnitFromCart = (clusterKey: string) => {
    const draft = selection[clusterKey]
    if (!draft || String(draft.product.type).toUpperCase() !== 'ACCESSORY') return
    const stock = draft.products.reduce((sum, product) => sum + getAvailableStockForProduct(product), 0)
    if (draft.units >= Math.max(1, stock)) {
      showToast('Sin mas stock disponible para ese accesorio.')
      return
    }
    handleQuantityChange(clusterKey, draft.units + 1)
  }

  const handleToggleClusterProduct = (cluster: ProductCluster, product: ApiProduct, isSelected: boolean) => {
    if (isSelected) {
      if (getAvailableStockForProduct(product) <= 0) return
      if (isBagProduct(product)) setDefaultBagDismissed(false)
      setPrimaryClusterProductByKey((prev) => ({ ...prev, [cluster.key]: product.id }))

      const selectedUnits = getSelectionKeysForCluster(cluster).reduce((sum, key) => sum + (selection[key]?.units ?? 0), 0)
      setSelection((prev) => allocateAccessoryClusterSelection(prev, cluster, product, selectedUnits || 1))
      return
    }

    const keyToRemove = getSelectionKeyForProduct(product)
    if (!keyToRemove) return
    const removed = selection[keyToRemove]
    if (removed && isBagProduct(removed.product)) setDefaultBagDismissed(true)
    if (primaryClusterProductByKey[cluster.key] === product.id) {
      const nextPrimaryProduct = cluster.products.find((item) => item.id !== product.id && !!getSelectionKeyForProduct(item))
      setPrimaryClusterProductByKey((prev) => {
        const next = { ...prev }
        if (nextPrimaryProduct) next[cluster.key] = nextPrimaryProduct.id
        else delete next[cluster.key]
        return next
      })
    }
    setSelection((prev) => removeSelectionKeys(prev, [keyToRemove]))
  }

  const handleClusterQuantityChange = (cluster: ProductCluster, units: number) => {
    const selectedKeys = getSelectionKeysForCluster(cluster)
    if (selectedKeys.length === 0) return

    const primaryProduct =
      cluster.products.find((product) => product.id === primaryClusterProductByKey[cluster.key]) ??
      cluster.products.find((product) => !!getSelectionKeyForProduct(product)) ??
      cluster.products.find((product) => getAvailableStockForProduct(product) > 0)

    if (!primaryProduct) return
    setPrimaryClusterProductByKey((prev) => ({ ...prev, [cluster.key]: primaryProduct.id }))
    setSelection((prev) => allocateAccessoryClusterSelection(prev, cluster, primaryProduct, units))
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
          unitPrice: draft.unitPrice ?? product.salePrice ?? '0',
          unitCost: draft.unitCost ?? product.costPrice ?? '0',
          extraCost: draft.extraCost,
          kind: draft.kind,
          _id: index === 0 && draft.existingId ? draft.existingId : `${product.id}-${timestamp}-${index}`,
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
      getProductDisplayColor(product),
      product.type === 'PHONE' ? getProductDisplayCapacity(product) : null,
      product.imei ? `IMEI ${product.imei}` : 'IMEI N/A',
    ].filter(Boolean).join(' · ')
  }

  const productAttributeLine = (product: ApiProduct | (Product & ProductCatalogDisplayProduct)) => {
    const color = getProductDisplayColor(product)
    const capacity = product.type === 'PHONE' ? getProductDisplayCapacity(product) : null
    if (!color && !capacity) return null

    return (
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs opacity-70">
        {color ? (
          <span className="inline-flex items-center gap-1">
            <ProductColorSwatch hexColor={getProductDisplayColorHex(product)} title={color} />
            {color}
          </span>
        ) : null}
        {capacity ? <span>{capacity}</span> : null}
      </div>
    )
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
              {selectedEntries.map(([clusterKey, draft]) => {
                const displayName = getProductDisplayModel(draft.product)
                const isAccessoryCartItem = String(draft.product.type).toUpperCase() === 'ACCESSORY'
                const accessoryStock = draft.products.reduce((sum, product) => sum + getAvailableStockForProduct(product), 0)
                const canAddAccessoryUnit = isAccessoryCartItem && draft.units < Math.max(1, accessoryStock)
                return (
                  <span key={clusterKey} className="badge badge-primary badge-outline h-auto min-h-7 max-w-full gap-1 py-1 pl-3 pr-1">
                    <button
                      type="button"
                      className={`max-w-[18rem] truncate text-left ${isAccessoryCartItem ? 'cursor-pointer hover:text-primary' : 'cursor-default'}`}
                      onClick={() => {
                        if (isAccessoryCartItem) addAccessoryUnitFromCart(clusterKey)
                      }}
                      title={isAccessoryCartItem ? (canAddAccessoryUnit ? 'Click para agregar otra unidad de este accesorio' : 'Sin mas stock disponible para este accesorio') : undefined}
                      aria-label={isAccessoryCartItem ? `Agregar otra unidad de ${displayName}` : undefined}
                    >
                      {displayName}{draft.units > 1 ? ` x${draft.units}` : ''}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle size-5 min-h-0"
                      onClick={() => removeSelection(clusterKey)}
                      aria-label={`Quitar ${displayName}`}
                      title="Quitar seleccion"
                    >
                      <XMarkIcon className="size-3" />
                    </button>
                  </span>
                )
              })}
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
                      const representativeName = getProductDisplayModel(representative)

                      return (
                        <tr key={clusterKey}>
                          <td>
                            <Link href={productEditHref(representative.id)} className="link link-hover link-primary font-medium">
                              {representativeName}
                            </Link>
                            {productAttributeLine(representative)}
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
                              aria-label={`Quitar ${representativeName}`}
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
                    const isCluster = cluster.products.length > 1
                    const usesClusterItemSelection = isCluster && p.type === 'ACCESSORY'
                    const currentStock = cluster.totalStock
                    const stockDetail = cluster.stockParts.length > 1
                      ? `${cluster.stockParts.join(' + ')} = ${cluster.totalStock}`
                      : `Stock disponible: ${cluster.totalStock}`
                    const selectedKeys = getSelectionKeysForCluster(cluster)
                    const selectedKey = selectedKeys.length === 1 ? selectedKeys[0] : null
                    const selectedDraft = selectedKey ? selection[selectedKey] : null
                    const selectedDrafts = selectedKeys.map((key) => selection[key]).filter(Boolean)
                    const selectedClusterUnits = selectedDrafts.reduce((sum, draft) => sum + draft.units, 0)
                    const isSelected = selectedKeys.length > 0
                    const isUnavailable = currentStock <= 0 && !isSelected
                    const isExpanded = !!expandedClusters[cluster.key]
                    const suggestions = p.type === 'PHONE' ? suggestionsByPhoneId[p.id] ?? [] : []
                    const parentClientLineId = p.type === 'PHONE' ? getPhoneLineId(cluster) : null
                    const productName = getProductDisplayModel(p)

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
                              {productName}
                            </Link>
                            {isCluster ? (
                              <ul className="dropdown-content menu menu-xs z-20 mt-1 w-72 rounded-box border border-base-content/10 bg-base-100 p-2 shadow">
                                {cluster.products.map((product, index) => (
                                  <li key={product.id}>
                                    <Link href={productEditHref(product.id)} className="flex items-center justify-between gap-2">
                                      <span className="truncate">{getProductDisplayModel(product)}</span>
                                      <span className="badge badge-ghost badge-xs">{Math.max(0, availableStock.get(product.id) ?? 0)}</span>
                                      <span className="text-xs opacity-60">#{index + 1}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          {productAttributeLine(p)}
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
                          {usesClusterItemSelection && isSelected ? (
                            <input
                              type="number"
                              value={selectedClusterUnits}
                              onChange={(e) => handleClusterQuantityChange(cluster, parseInt(e.target.value, 10))}
                              className="input input-bordered input-xs w-20"
                              min={1}
                              max={currentStock}
                            />
                          ) : selectedKey && selectedDraft ? (
                            <input
                              type="number"
                              value={selectedDraft.units}
                              onChange={(e) => handleQuantityChange(selectedKey, parseInt(e.target.value, 10))}
                              className="input input-bordered input-xs w-20"
                              min={1}
                              max={currentStock}
                            />
                          ) :
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
                      {isSelected && p.type === 'PHONE' && (suggestions.length > 0 || suggestionsLoading) ? (
                        <tr>
                          <td colSpan={10} className="bg-primary/5 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">Sugerencias compatibles</span>
                              {suggestionsLoading && suggestions.length === 0 ? (
                                <span className="loading loading-spinner loading-xs text-primary" />
                              ) : null}
                              {suggestions.map((suggestion) => {
                                const available = getSuggestionAvailableStock(suggestion)
                                const selected = getSuggestionSelected(suggestion, parentClientLineId)
                                const disabled = available <= 0
                                const chipClass = selected
                                  ? 'border-primary bg-primary text-primary-content'
                                  : disabled
                                    ? 'border-base-300 bg-base-200 text-base-content/40'
                                    : 'border-primary/40 bg-base-100 text-base-content hover:border-primary hover:bg-primary hover:text-primary-content'
                                return (
                                  <button
                                    key={suggestion.catalogModelId}
                                    type="button"
                                    className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${chipClass}`}
                                    disabled={disabled}
                                    title={disabled ? 'Sin stock' : `Stock disponible: ${available}. Click para agregar al carrito.`}
                                    aria-label={disabled ? `${suggestion.modelName} sin stock` : `Agregar ${suggestion.modelName} a la venta`}
                                    onClick={(event) => addSuggestedAccessory(event, cluster, suggestion)}
                                  >
                                    <span>{suggestion.modelName}</span>
                                    <span aria-hidden="true">+</span>
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {isCluster && isExpanded ? (
                        <tr>
                          <td colSpan={10} className="bg-base-200/50 p-0">
                            <div className="p-3">
                              <table className="table table-xs w-full">
                                <thead>
                                  <tr>
                                    {usesClusterItemSelection ? <th></th> : null}
                                    <th>Producto</th>
                                    {usesClusterItemSelection ? null : <th>IMEI</th>}
                                    <th>Ubicación</th>
                                    <th>Stock</th>
                                    {usesClusterItemSelection ? <th>Cant.</th> : null}
                                    <th>Precio</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cluster.products.map((product) => {
                                    const itemSelectionKey = getSelectionKeyForProduct(product)
                                    const isItemSelected = !!itemSelectionKey
                                    const itemSelectedUnits = itemSelectionKey ? selection[itemSelectionKey]?.units ?? 0 : 0
                                    const productStock = Math.max(0, availableStock.get(product.id) ?? 0)
                                    const isItemUnavailable = productStock <= 0 && !isItemSelected

                                    return (
                                      <tr key={product.id} className={`${isItemSelected ? 'bg-success/10' : ''} ${isItemUnavailable ? 'opacity-50' : ''}`}>
                                        {usesClusterItemSelection ? (
                                          <td>
                                            <input
                                              type="checkbox"
                                              checked={isItemSelected}
                                              onChange={(event) => handleToggleClusterProduct(cluster, product, event.target.checked)}
                                              className="checkbox checkbox-xs"
                                              disabled={isItemUnavailable}
                                              title={isItemSelected ? 'Quitar item del carrito' : 'Agregar item al carrito'}
                                              aria-label={isItemSelected ? `Quitar ${getProductDisplayModel(product)}` : `Agregar ${getProductDisplayModel(product)}`}
                                            />
                                          </td>
                                        ) : null}
                                        <td>
                                          <Link href={productEditHref(product.id)} className="link link-hover link-primary font-medium">
                                            {getProductDisplayModel(product)}
                                          </Link>
                                          {productAttributeLine(product)}
                                        </td>
                                        {usesClusterItemSelection ? null : <td><ImeiDisplay imei={product.imei} fallback="N/A" /></td>}
                                        <td><span className="badge badge-ghost badge-xs">{productStock}</span></td>
                                        <td>{product.location || '-'}</td>
                                        {usesClusterItemSelection ? (
                                          <td>
                                            {itemSelectedUnits > 0 ? (
                                              <span className="badge badge-primary badge-xs">{itemSelectedUnits}</span>
                                            ) : (
                                              <span className="text-xs opacity-50">-</span>
                                            )}
                                          </td>
                                        ) : null}
                                        <td>${product.salePrice ?? '0'}</td>
                                        <td className="text-right">
                                          {canOpenProductEdit ? (
                                            <Link href={productEditHref(product.id)} className="btn btn-ghost btn-xs btn-square" title="Editar producto" aria-label="Editar producto">
                                              <PencilIcon className="size-3.5" />
                                            </Link>
                                          ) : null}
                                        </td>
                                      </tr>
                                    )
                                  })}
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
