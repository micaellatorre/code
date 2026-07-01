// code/src/components/products/useProductsInventory.ts

import { createElement, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { fromArgDateInputValue } from "@/lib/timezone"
import type { Role } from "@/lib/auth/roles"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import type { InventorySegment, ProductsApiResponse, SerializedProduct } from "./types"
import { compareIphoneModels, getIphoneSeries, getSeriesSortValue, isSealedPhone, normalizeModelKey } from "./utils"

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(await res.text())
  const body = (await res.json()) as ProductsApiResponse
  return body
}

const DEFAULT_STATE_FILTER = "EN_STOCK"

export function useProductsInventory() {
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"
  const isSeller = activeRole === "VENDEDOR"
  const isStock = activeRole === "STOCK"
  const isSocio = activeRole === "SOCIO"
  const canSeeCosts = isAdmin
  const canSeeSalePrice = isAdmin || isSeller || isSocio
  const canCreateProducts = isAdmin || isStock || isSeller
  const canEditProducts = isAdmin || isStock
  const canDuplicateProducts = isAdmin
  const canDeleteProducts = isAdmin || isStock
  const canEditStock = isAdmin || isStock
  const canEditState = isAdmin || isStock
  const isReadOnly = !canEditProducts
  const hasProductActions = canEditProducts || canDuplicateProducts || canDeleteProducts

  const [viewMode, setViewMode] = useState<"DETAIL" | "GENERAL">("DETAIL")
  const [inventorySegment, setInventorySegment] = useState<InventorySegment>("PHONES")

  // server-backed filters (hit the API)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("PHONE")
  const [stateFilter, setStateFilter] = useState<string>(DEFAULT_STATE_FILTER)
  const [senadoFilter, setSenadoFilter] = useState<string>("")

  // client-side filters (work on already-fetched page)
  const [brandFilter, setBrandFilter] = useState<string>("")
  const [conditionFilter, setConditionFilter] = useState<string>("")
  const [batteryMin, setBatteryMin] = useState<string>("")
  const [batteryMax, setBatteryMax] = useState<string>("")
  const [colorFilter, setColorFilter] = useState<string>("")
  const [capacityFilter, setCapacityFilter] = useState<string>("")
  const [originFilter, setOriginFilter] = useState<string>("")
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [imeiSearch, setImeiSearch] = useState<string>("")

  // UI state
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [showSensitiveColumns, setShowSensitiveColumns] = useState(true)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const visibleOriginColumn = showSensitiveColumns
  const visibleLocationColumn = showSensitiveColumns
  const visibleImeiColumn = showSensitiveColumns
  const visibleCostColumn = canSeeCosts && showSensitiveColumns
  const visibleSalePriceColumn = canSeeSalePrice && showSensitiveColumns
  const generalColumnCount = 6 + (visibleCostColumn ? 1 : 0) + (visibleSalePriceColumn ? 1 : 0) + 1

  // editing state
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, string>>>({})
  const [savingField, setSavingField] = useState<{ productId: string; fieldName: string } | null>(null)
  const [savingStateId, setSavingStateId] = useState<string | null>(null)
  const [savingSenadoId, setSavingSenadoId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  // pagination (cursor-based)
  const [cursor, setCursor] = useState<string | null>(null)
  const [limit] = useState<number>(100)
  const [orderBy, setOrderBy] = useState("alpha_asc")

  // Reset pagination when server-backed filters change
  useEffect(() => {
    setCursor(null)
  }, [search, typeFilter, stateFilter, senadoFilter])

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams()
    if (typeFilter) sp.set("type", typeFilter)
    if (stateFilter) sp.set("state", stateFilter)
    if (senadoFilter) sp.set("senado", senadoFilter)
    if (search.trim()) sp.set("q", search.trim())
    sp.set("orderBy", orderBy)
    sp.set("limit", String(limit))
    if (cursor) sp.set("cursor", cursor)
    return `/api/products?${sp.toString()}`
  }, [search, typeFilter, stateFilter, senadoFilter, orderBy, limit, cursor])

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  // local list so you can keep all your optimistic UI logic
  const [productsLocal, setProductsLocal] = useState<SerializedProduct[]>([])
  const totalProducts = data?.totalProducts ?? null

  useEffect(() => {
    if (!data) return
    setProductsLocal((prev) => {
      if (!cursor) return data.products
      const seen = new Set(prev.map((p) => p.id))
      const merged = prev.slice()
      for (const p of data.products) if (!seen.has(p.id)) merged.push(p)
      return merged
    })
  }, [apiUrl, data, cursor, totalProducts])

  // enums + labels
  const stateOptions = ["EN_STOCK", "EN_CAMINO", "EN_REPARACION", "CON_CLIENTE", "DISPONIBLE", "FUERA_DE_STOCK", "VENDIDO"] as const
  const stateColorMap: Record<string, string> = {
    EN_STOCK: "badge-success",
    EN_CAMINO: "badge-info",
    EN_REPARACION: "badge-warning",
    CON_CLIENTE: "badge-primary",
    DISPONIBLE: "badge-accent",
    VENDIDO: "badge-outline",
    FUERA_DE_STOCK: "badge-error",
  }
  const stateLabelMap: Record<string, string> = {
    EN_STOCK: "En stock",
    EN_CAMINO: "En camino",
    EN_REPARACION: "En reparacion",
    CON_CLIENTE: "Con cliente",
    DISPONIBLE: "Disponible para venta",
    VENDIDO: "Vendido",
    FUERA_DE_STOCK: "Fuera de stock",
  }

  const conditionOptions = ["A_PLUS", "OEM", "ASIS", "ASIS_PLUS", "SEALED"] as const
  const conditionLabelMap: Record<string, string> = {
    A_PLUS: "A+",
    OEM: "OEM",
    ASIS: "ASIS",
    ASIS_PLUS: "ASIS+",
    SEALED: "Sellado",
  }

  // derived filter values from loaded page
  const brands = useMemo(
    () => Array.from(new Set(productsLocal.map((p) => p.brand).filter(Boolean) as string[])),
    [productsLocal],
  )
  const conditions = useMemo(
    () => Array.from(new Set(productsLocal.map((p) => p.condition).filter(Boolean) as string[])),
    [productsLocal],
  )
  const colors = useMemo(
    () => Array.from(new Set(productsLocal.map((p) => p.color).filter(Boolean) as string[])),
    [productsLocal],
  )
  const capacities = useMemo(
    () =>
      Array.from(
        new Set(productsLocal.map((p) => p.capacityGB).filter((n): n is number => n != null) as number[]),
      ).sort((a, b) => a - b),
    [productsLocal],
  )

  // client-side filtered list (search/type/state already applied server-side)
  const filteredProducts = useMemo(() => {
    const min = batteryMin === "" ? null : Number(batteryMin)
    const max = batteryMax === "" ? null : Number(batteryMax)

    return productsLocal.filter((p) => {
      const matchesBrand = brandFilter ? p.brand === brandFilter : true
      const matchesCondition = conditionFilter ? p.condition === conditionFilter : true
      const matchesColor = colorFilter ? p.color === colorFilter : true
      const matchesCapacity = capacityFilter ? p.capacityGB === Number(capacityFilter) : true
      const matchesOrigin = originFilter
        ? (p.origin ?? "").toLowerCase().includes(originFilter.trim().toLowerCase())
        : true
      const matchesLocation = locationFilter ? p.location === locationFilter : true
      const matchesImei = imeiSearch
        ? (p.imei ?? "").toLowerCase().includes(imeiSearch.trim().toLowerCase())
        : true

      let matchesBattery = true
      if (min != null || max != null) {
        if (p.batteryPct == null) {
          matchesBattery = false
        } else {
          if (min != null && p.batteryPct < min) matchesBattery = false
          if (max != null && p.batteryPct > max) matchesBattery = false
        }
      }

      return matchesBrand && matchesCondition && matchesColor && matchesCapacity && matchesOrigin && matchesLocation && matchesImei && matchesBattery
    })
  }, [productsLocal, brandFilter, conditionFilter, colorFilter, capacityFilter, originFilter, locationFilter, imeiSearch, batteryMin, batteryMax])

  const locations = useMemo(
    () => Array.from(new Set(productsLocal.map((p) => p.location).filter(Boolean) as string[])).sort(),
    [productsLocal],
  )

  const operationalProducts = useMemo(
    () =>
      inventorySegment === "TRADE_INS"
        ? filteredProducts.filter((p) => (p.origin ?? "").trim().toUpperCase() === "PLAN_CANJE")
        : filteredProducts,
    [filteredProducts, inventorySegment],
  )

  const phoneSections = useMemo(() => {
    const makeGroups = (items: SerializedProduct[]) => {
      const map = new Map<string, SerializedProduct[]>()
      for (const product of items) {
        const series = getIphoneSeries(product.modelName)
        map.set(series, [...(map.get(series) ?? []), product])
      }
      return Array.from(map.entries())
        .map(([series, products]) => ({ series, products: products.sort(compareIphoneModels) }))
        .sort((a, b) => getSeriesSortValue(b.series) - getSeriesSortValue(a.series))
    }
    return {
      used: makeGroups(operationalProducts.filter((p) => !isSealedPhone(p))),
      sealed: makeGroups(operationalProducts.filter(isSealedPhone)),
    }
  }, [operationalProducts])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; items: SerializedProduct[]; newest: number; stockSum: number; availSum: number }
    >()

    for (const p of filteredProducts) {
      const key = normalizeModelKey(p.modelName)
      if (!key) continue
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          label: p.modelName,
          items: [p],
          newest: p.createdAt ? new Date(p.createdAt).getTime() : 0,
          stockSum: p.stock ?? 0,
          availSum: p.stockAvailable ?? 0,
        })
      } else {
        existing.items.push(p)
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0
        if (t > existing.newest) existing.newest = t
        existing.stockSum += p.stock ?? 0
        existing.availSum += p.stockAvailable ?? 0
      }
    }

    const groups = Array.from(map.values())
    groups.sort((a, b) => b.newest - a.newest)
    return groups
  }, [filteredProducts])

  const groupedCounts = useMemo(() => {
    let totalStock = 0
    let totalAvail = 0
    for (const g of grouped) {
      totalStock += g.stockSum
      totalAvail += g.availSum
    }
    return { groups: grouped.length, instances: filteredProducts.length, totalStock, totalAvail }
  }, [grouped, filteredProducts.length])

  function clearFilters() {
    setSearch("")
    setBrandFilter("")
    setConditionFilter("")
    setBatteryMin("")
    setBatteryMax("")
    setColorFilter("")
    setCapacityFilter("")
    setOriginFilter("")
    setLocationFilter("")
    setImeiSearch("")
    setStateFilter(DEFAULT_STATE_FILTER)
    setSenadoFilter("")
  }

  function selectInventorySegment(segment: InventorySegment) {
    setInventorySegment(segment)
    setTypeFilter(segment === "ACCESSORIES" ? "ACCESSORY" : "PHONE")
  }

  function toggleProductSelection(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function canEditField(fieldName: string) {
    if (fieldName === "costPrice") return canSeeCosts && canEditProducts
    if (fieldName === "salePrice") return canSeeSalePrice && canEditProducts
    if (["stock", "stockInitial", "stockAvailable"].includes(fieldName)) return canEditStock
    if (fieldName === "state") return canEditState
    return canEditProducts
  }

  function editableCellProps(productId: string, fieldName: string, currentValue: any) {
    if (!canEditField(fieldName)) {
      return {
        className: "rounded px-1",
      }
    }

    return {
      className: "cursor-pointer hover:bg-base-200 rounded px-1",
      onClick: () => startEditField(productId, fieldName, currentValue),
      title: "Click para editar",
    }
  }

  function startEditField(productId: string, fieldName: string, currentValue: any) {
    if (!canEditField(fieldName)) return

    setEditingFields((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [fieldName]: currentValue == null ? "" : String(currentValue),
      },
    }))
  }

  function cancelEditField(productId: string, fieldName: string) {
    setEditingFields((prev) => {
      const updated = { ...prev }
      if (updated[productId]) {
        const productFields = { ...updated[productId] }
        delete productFields[fieldName]
        if (Object.keys(productFields).length === 0) delete updated[productId]
        else updated[productId] = productFields
      }
      return updated
    })
  }

  function updateEditingValue(productId: string, fieldName: string, value: string) {
    setEditingFields((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [fieldName]: value,
      },
    }))
  }

  async function persistFieldUpdate(productId: string, fieldName: string, value: any, rollback: SerializedProduct | null) {
    if (!canEditField(fieldName)) return

    setSavingField({ productId, fieldName })
    try {
      const updateBody: any = { [fieldName]: value }

      if (fieldName === "stock") {
        const product = productsLocal.find((p) => p.id === productId)
        if (product) {
          const delta = Number(value) - (product.stock ?? 0)
          updateBody.stockAvailable = Math.max(0, (product.stockAvailable ?? 0) + delta)
        }
      }

      console.log("Persisting update", { productId, fieldName, value, updateBody })

      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()

      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
              ...p,
              [fieldName]: Object.prototype.hasOwnProperty.call(updated, fieldName)
                ? updated[fieldName]
                : (p as any)[fieldName],
              ...(fieldName === "stock" && updated.stockAvailable !== undefined
                ? { stockAvailable: updated.stockAvailable }
                : {}),
            }
            : p,
        ),
      )

      cancelEditField(productId, fieldName)
      mutate() // revalidate list in background
    } catch (err) {
      if (rollback) setProductsLocal((prev) => prev.map((p) => (p.id === productId ? rollback : p)))
      console.error(`Failed to persist ${fieldName} update`, err)
    } finally {
      setSavingField(null)
    }
  }

  function commitEditField(productId: string, fieldName: string) {
    if (!canEditField(fieldName)) return

    const editingValue = editingFields[productId]?.[fieldName]
    if (editingValue === undefined) return

    const product = productsLocal.find((p) => p.id === productId)
    if (!product) return

    const rollback = { ...product }

    let processedValue: any = editingValue.trim() === "" ? null : editingValue.trim()

    if (["capacityGB", "batteryPct"].includes(fieldName)) {
      if (processedValue === null || processedValue === "") processedValue = null
      else {
        const num = parseInt(processedValue, 10)
        if (Number.isNaN(num) || num < 0) return
        if (fieldName === "batteryPct" && num > 100) return
        processedValue = num
      }
    } else if (["stock", "stockInitial", "stockAvailable"].includes(fieldName)) {
      const num = parseInt(processedValue || "0", 10)
      if (Number.isNaN(num) || num < 0) return
      processedValue = num
    } else if (["costPrice", "salePrice"].includes(fieldName)) {
      const num = parseFloat(processedValue || "0")
      if (!Number.isFinite(num) || num < 0) return
      processedValue = num
    } else if (fieldName === "shippingCost") {
      if (processedValue === null || processedValue === "") processedValue = null
      else {
        const num = parseFloat(processedValue)
        if (!Number.isFinite(num) || num < 0) return
        processedValue = num
      }
    } else if (fieldName === "createdAt") {
      if (processedValue === null || processedValue === "") processedValue = null
      else processedValue = fromArgDateInputValue(processedValue).toISOString()
    } else if (["imei", "color", "brand", "notes", "location", "origin"].includes(fieldName)) {
      processedValue = processedValue === "" ? null : processedValue
    }

    setProductsLocal((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
            ...p,
            [fieldName]: processedValue,
            ...(fieldName === "stock"
              ? {
                stockAvailable: Math.max(0, (p.stockAvailable ?? 0) + (processedValue - (p.stock ?? 0))),
              }
              : {}),
          }
          : p,
      ),
    )

    persistFieldUpdate(productId, fieldName, processedValue, rollback)
  }

  function isEditing(productId: string, fieldName: string): boolean {
    return editingFields[productId]?.[fieldName] !== undefined
  }

  function getEditingValue(productId: string, fieldName: string): string {
    return editingFields[productId]?.[fieldName] ?? ""
  }

  async function persistStockUpdate(id: string, newStock: number, newStockAvailable?: number) {
    if (!canEditStock) return

    setSavingField({ productId: id, fieldName: "stock" })
    const original = productsLocal.find((p) => p.id === id) ?? null

    const optimisticNext = (() => {
      if (!original) return null
      const prevState = original.state
      if (newStock < 1 && prevState !== "FUERA_DE_STOCK") return "FUERA_DE_STOCK"
      if (newStock >= 1 && prevState === "FUERA_DE_STOCK") return "EN_STOCK"
      return prevState
    })()

    if (original) {
      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              stock: newStock,
              stockAvailable: newStockAvailable !== undefined ? newStockAvailable : p.stockAvailable,
              state: optimisticNext ?? p.state,
            }
            : p,
        ),
      )
    }

    try {
      const updateBody: { stock: number; stockAvailable?: number } = { stock: newStock }
      if (newStockAvailable !== undefined) updateBody.stockAvailable = newStockAvailable

      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
        cache: "no-store",
      })
      if (!res.ok) throw new Error(await res.text())

      const updated = await res.json()
      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              stock: updated.stock,
              stockAvailable: updated.stockAvailable ?? p.stockAvailable,
              state: updated.state,
            }
            : p,
        ),
      )
      mutate()
    } catch (err) {
      if (original) setProductsLocal((prev) => prev.map((p) => (p.id === id ? original : p)))
      console.error("Failed to persist stock update", err)
    } finally {
      setSavingField(null)
    }
  }

  function startEditStock(id: string, value: number) {
    if (!canEditStock) return

    startEditField(id, "stock", value)
  }

  function changeStockBy(id: string, delta: number) {
    if (!canEditStock) return

    const p = productsLocal.find((x) => x.id === id)
    if (!p) return
    const newStock = Math.max(0, (p.stock ?? 0) + delta)
    const newStockAvailable = Math.max(0, (p.stockAvailable ?? 0) + delta)

    setProductsLocal((prev) =>
      prev.map((prod) => (prod.id === id ? { ...prod, stock: newStock, stockAvailable: newStockAvailable } : prod)),
    )
    persistStockUpdate(id, newStock, newStockAvailable)
  }

  async function persistStateUpdate(id: string, newState: string) {
    if (!canEditState) return

    setSavingStateId(id)
    const rollback = productsLocal.find((p) => p.id === id) ?? null

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, state: updated.state } : p)))
      mutate()
    } catch (err) {
      if (rollback) setProductsLocal((prev) => prev.map((p) => (p.id === id ? rollback : p)))
      console.error("Failed to persist state update", err)
    } finally {
      setSavingStateId(null)
    }
  }

  async function changeState(id: string, newState: string) {
    if (!canEditState) return

    const product = productsLocal.find((p) => p.id === id)
    if (!product || product.state === newState) return

    const confirmed = await confirmDialog.confirm({
      variant: "warning",
      title: "Cambiar estado del producto",
      description: "Esta accion cambiara la disponibilidad operativa del producto seleccionado.",
      details: [
        { label: "Producto", value: product.modelName },
        { label: "IMEI", value: createElement(ImeiDisplay, { imei: product.imei, fallback: "Sin IMEI" }) },
        { label: "Estado actual", value: product.state },
        { label: "Nuevo estado", value: newState },
        { label: "Sucursal", value: product.location ?? "Sin sucursal" },
      ],
      banner: {
        variant: "warning",
        description: "Verifica que el nuevo estado coincida con la situacion real del equipo.",
      },
      confirmLabel: "Cambiar estado",
      cancelLabel: "Cerrar",
    })

    if (!confirmed) return

    setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, state: newState } : p)))
    persistStateUpdate(id, newState)
  }

  async function changeSenado(id: string, nextSenado: boolean) {
    if (!canEditProducts) return

    setSavingSenadoId(id)
    const rollback = productsLocal.find((p) => p.id === id) ?? null
    const nextSenadoAt = nextSenado ? new Date().toISOString() : null

    setProductsLocal((prev) =>
      prev.map((p) => (p.id === id ? { ...p, senado: nextSenado, senadoAt: nextSenadoAt } : p)),
    )

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senado: nextSenado }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                senado: updated.senado,
                senadoAt: updated.senadoAt ? new Date(updated.senadoAt).toISOString() : null,
              }
            : p,
        ),
      )
      mutate()
    } catch (err) {
      if (rollback) setProductsLocal((prev) => prev.map((p) => (p.id === id ? rollback : p)))
      console.error("Failed to persist senado update", err)
    } finally {
      setSavingSenadoId(null)
    }
  }

  async function deleteProduct(id: string) {
    if (!canDeleteProducts) return

    const product = productsLocal.find((p) => p.id === id)
    let failed = false

    const confirmed = await confirmDialog.confirmAction({
      variant: "danger",
      title: "Eliminar producto",
      description: "Esta accion eliminara el producto del inventario. No podra recuperarse desde esta pantalla.",
      details: product
        ? [
            { label: "Producto", value: product.modelName },
            { label: "IMEI", value: createElement(ImeiDisplay, { imei: product.imei, fallback: "Sin IMEI" }) },
            { label: "Estado", value: product.state },
            { label: "Sucursal", value: product.location ?? "Sin sucursal" },
            { label: "Costo", value: product.costPrice ?? "0", sensitive: true },
            { label: "Precio venta", value: product.salePrice ?? "0", sensitive: true },
          ]
        : undefined,
      banner: {
        variant: "danger",
        title: "Accion destructiva",
        description: "Esta operacion no puede deshacerse desde esta pantalla.",
      },
      confirmLabel: "Eliminar",
      cancelLabel: "Cerrar",
      loadingLabel: "Eliminando...",
      onConfirm: async () => {
        setDeletingId(id)

        const originalIndex = productsLocal.findIndex((p) => p.id === id)
        const original = productsLocal[originalIndex]

        setProductsLocal((prev) => prev.filter((p) => p.id !== id))

        try {
          const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
          if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
          mutate()
        } catch (err) {
          setProductsLocal((prev) => {
            const copy = prev.slice()
            copy.splice(originalIndex, 0, original)
            return copy
          })
          console.error("Failed to delete product", err)
          failed = true
        } finally {
          setDeletingId(null)
        }
      },
    })

    if (confirmed && failed) {
      await confirmDialog.confirm({
        variant: "danger",
        title: "No se pudo eliminar el producto",
        description: "Se revirtieron los cambios y el producto vuelve a mostrarse en el inventario.",
        confirmLabel: "Cerrar",
        hideCancel: true,
      })
    }
  }

  async function duplicateProduct(id: string) {
    if (!canDuplicateProducts) return

    const product = productsLocal.find((p) => p.id === id)
    let failed = false

    const confirmed = await confirmDialog.confirmAction({
      variant: "info",
      title: "Duplicar producto",
      description: "Esta accion creara una copia del producto seleccionado para acelerar la carga de inventario.",
      details: product
        ? [
            { label: "Producto base", value: product.modelName },
            { label: "IMEI", value: createElement(ImeiDisplay, { imei: product.imei, fallback: "Sin IMEI" }) },
            { label: "Estado", value: product.state },
            { label: "Costo", value: product.costPrice ?? "0", sensitive: true },
            { label: "Precio venta", value: product.salePrice ?? "0", sensitive: true },
          ]
        : undefined,
      banner: {
        variant: "info",
        description: "Revisa los datos unicos del producto duplicado despues de crearlo.",
      },
      confirmLabel: "Duplicar",
      cancelLabel: "Cerrar",
      loadingLabel: "Duplicando...",
      onConfirm: async () => {
        setDuplicatingId(id)
        try {
          const res = await fetch(`/api/products/${id}/duplicate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
          if (!res.ok) throw new Error(await res.text())
          const { product: newProduct } = await res.json()

          setProductsLocal((prev) => {
            const index = prev.findIndex((p) => p.id === id)
            const newProducts = [...prev]
            newProducts.splice(index + 1, 0, newProduct)
            return newProducts
          })
          mutate()
        } catch (err) {
          console.error("Failed to duplicate product", err)
          failed = true
        } finally {
          setDuplicatingId(null)
        }
      },
    })

    if (confirmed && failed) {
      await confirmDialog.confirm({
        variant: "danger",
        title: "No se pudo duplicar el producto",
        description: "El producto no fue duplicado. Intenta nuevamente.",
        confirmLabel: "Cerrar",
        hideCancel: true,
      })
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }


  const hasNext = !!data?.nextCursor

  return {
    activeRole, isAdmin, isSeller, isStock, isSocio, canSeeCosts, canSeeSalePrice, canCreateProducts, canEditProducts, canDuplicateProducts, canDeleteProducts, canEditStock, canEditState, isReadOnly, hasProductActions,
    viewMode, setViewMode, inventorySegment, setInventorySegment, search, setSearch, typeFilter, setTypeFilter, stateFilter, setStateFilter, senadoFilter, setSenadoFilter,
    brandFilter, setBrandFilter, conditionFilter, setConditionFilter, batteryMin, setBatteryMin, batteryMax, setBatteryMax, colorFilter, setColorFilter, capacityFilter, setCapacityFilter, originFilter, setOriginFilter, locationFilter, setLocationFilter, imeiSearch, setImeiSearch,
    isTableExpanded, setIsTableExpanded, drawerOpen, setDrawerOpen, expandedGroups, setExpandedGroups, showSensitiveColumns, setShowSensitiveColumns, selectedProductIds, setSelectedProductIds, visibleOriginColumn, visibleLocationColumn, visibleImeiColumn, visibleCostColumn, visibleSalePriceColumn, generalColumnCount,
    editingFields, savingField, savingStateId, savingSenadoId, deletingId, duplicatingId, cursor, setCursor, limit, orderBy, setOrderBy, apiUrl, data, error, isLoading, mutate, productsLocal, setProductsLocal, totalProducts,
    stateOptions, stateColorMap, stateLabelMap, conditionOptions, conditionLabelMap, brands, conditions, colors, capacities, filteredProducts, locations, operationalProducts, phoneSections, grouped, groupedCounts, hasNext,
    clearFilters, selectInventorySegment, toggleProductSelection, canEditField, editableCellProps, startEditField, cancelEditField, updateEditingValue, persistFieldUpdate, commitEditField, isEditing, getEditingValue, persistStockUpdate, startEditStock, changeStockBy, persistStateUpdate, changeState, changeSenado, deleteProduct, duplicateProduct, toggleGroup,
  }
}

export type ProductsInventory = ReturnType<typeof useProductsInventory>
