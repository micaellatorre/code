// code\src\components\FilterableProductsTable.tsx
"use client"

import React, { useMemo, useState, useEffect } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  FunnelIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/solid"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE, toArgDateInputValue, fromArgDateInputValue } from "@/lib/timezone"
import SearchBar from "@/components/SearchBar"
import type { Role } from "@/lib/auth/roles"

type SerializedProduct = {
  id: string
  tenantId: string
  type: string
  brand: string | null
  imei: string | null
  modelName: string
  capacityGB: number | string | null | any
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
  location: string | null
  origin: string | null
  createdAt: string | null
  updatedAt: string | null
}

type ProductsApiResponse = {
  products: SerializedProduct[]
  nextCursor: string | null
  totalProducts?: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ProductsApiResponse
}

function formatDecimal(value: unknown) {
  if (value == null) return "-"
  if (typeof value === "string") {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n.toFixed(2) : value
  }
  if (typeof value === "number") return value.toFixed(2)
  try {
    const s = String(value)
    const n = parseFloat(s)
    return Number.isFinite(n) ? n.toFixed(2) : s
  } catch {
    return String(value)
  }
}

function normalizeModelKey(modelName: string | null | undefined) {
  return (modelName ?? "").trim().toLowerCase()
}

function parseNumberOrNull(v: string | null) {
  if (v == null) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function rangeLabelFromItems(items: SerializedProduct[], field: "costPrice" | "salePrice") {
  const nums = items
    .map((p) => parseNumberOrNull(p[field]))
    .filter((n): n is number => n != null)
  if (nums.length === 0) return "-"
  let min = nums[0]
  let max = nums[0]
  for (const n of nums) {
    if (n < min) min = n
    if (n > max) max = n
  }
  if (min === max) return min.toFixed(2)
  return `${min.toFixed(2)} – ${max.toFixed(2)}`
}

function newestCreatedAt(items: SerializedProduct[]) {
  let best = 0
  for (const p of items) {
    const t = p.createdAt ? new Date(p.createdAt).getTime() : 0
    if (t > best) best = t
  }
  return best
}

export default function FilterableProductsTable() {
  const { data: session } = useSession()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"
  const isSeller = activeRole === "VENDEDOR"
  const isStock = activeRole === "STOCK"
  const isSocio = activeRole === "SOCIO"
  const canSeeCosts = isAdmin
  const canSeeSalePrice = isAdmin || isSeller || isSocio
  const canCreateProducts = isAdmin || isStock
  const canEditProducts = isAdmin || isStock
  const canDuplicateProducts = isAdmin
  const canDeleteProducts = isAdmin
  const canEditStock = isAdmin || isStock
  const canEditState = isAdmin || isStock
  const isReadOnly = !canEditProducts
  const hasProductActions = canEditProducts || canDuplicateProducts || canDeleteProducts

  const [viewMode, setViewMode] = useState<"DETAIL" | "GENERAL">("DETAIL")

  // server-backed filters (hit the API)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("PHONE")
  const [stateFilter, setStateFilter] = useState<string>("EN_STOCK")

  // client-side filters (work on already-fetched page)
  const [brandFilter, setBrandFilter] = useState<string>("")
  const [conditionFilter, setConditionFilter] = useState<string>("")
  const [batteryMin, setBatteryMin] = useState<string>("")
  const [batteryMax, setBatteryMax] = useState<string>("")
  const [colorFilter, setColorFilter] = useState<string>("")
  const [capacityFilter, setCapacityFilter] = useState<string>("")

  // UI state
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [showSensitiveColumns, setShowSensitiveColumns] = useState(true)
  const visibleOriginColumn = showSensitiveColumns
  const visibleLocationColumn = showSensitiveColumns
  const visibleImeiColumn = showSensitiveColumns
  const visibleCostColumn = canSeeCosts && showSensitiveColumns
  const generalColumnCount = 6 + (visibleCostColumn ? 1 : 0) + (canSeeSalePrice ? 1 : 0) + 1

  // editing state
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, string>>>({})
  const [savingField, setSavingField] = useState<{ productId: string; fieldName: string } | null>(null)
  const [savingStateId, setSavingStateId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  // pagination (cursor-based)
  const [cursor, setCursor] = useState<string | null>(null)
  const [limit] = useState<number>(100)
  const [orderBy, setOrderBy] = useState("alpha_asc")

  // Reset pagination when server-backed filters change
  useEffect(() => {
    setCursor(null)
  }, [search, typeFilter, stateFilter])

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams()
    if (typeFilter) sp.set("type", typeFilter)
    if (stateFilter) sp.set("state", stateFilter)
    if (search.trim()) sp.set("q", search.trim())
    sp.set("orderBy", orderBy)
    sp.set("limit", String(limit))
    if (cursor) sp.set("cursor", cursor)
    return `/api/products?${sp.toString()}`
  }, [search, typeFilter, stateFilter, orderBy, limit, cursor])

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  // local list so you can keep all your optimistic UI logic
  const [productsLocal, setProductsLocal] = useState<SerializedProduct[]>([])
  const totalProducts = data?.totalProducts ?? null

  useEffect(() => {
    if (!data) return
    // cursor pagination: append; first page: replace
    console.log(data)
    setProductsLocal((prev) => {
      if (!cursor) return data.products
      const seen = new Set(prev.map((p) => p.id))
      const merged = prev.slice()
      for (const p of data.products) if (!seen.has(p.id)) merged.push(p)
      return merged
    })
  }, [data, cursor])

  // enums + labels
  const stateOptions = ["EN_STOCK", "EN_CAMINO", "EN_REPARACION", "CON_CLIENTE", "VENDIDO"] as const
  const stateColorMap: Record<string, string> = {
    EN_STOCK: "badge-success",
    EN_CAMINO: "badge-info",
    EN_REPARACION: "badge-warning",
    CON_CLIENTE: "badge-primary",
    VENDIDO: "badge-outline",
    FUERA_DE_STOCK: "badge-error",
  }
  const stateLabelMap: Record<string, string> = {
    EN_STOCK: "En stock",
    EN_CAMINO: "En camino",
    EN_REPARACION: "En reparación",
    CON_CLIENTE: "Con cliente",
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

      let matchesBattery = true
      if (min != null || max != null) {
        if (p.batteryPct == null) {
          matchesBattery = false
        } else {
          if (min != null && p.batteryPct < min) matchesBattery = false
          if (max != null && p.batteryPct > max) matchesBattery = false
        }
      }

      return matchesBrand && matchesCondition && matchesColor && matchesCapacity && matchesBattery
    })
  }, [productsLocal, brandFilter, conditionFilter, colorFilter, capacityFilter, batteryMin, batteryMax])

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
    setStateFilter("")
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

  function changeState(id: string, newState: string) {
    if (!canEditState) return

    setProductsLocal((prev) => prev.map((p) => (p.id === id ? { ...p, state: newState } : p)))
    persistStateUpdate(id, newState)
  }

  async function deleteProduct(id: string) {
    if (!canDeleteProducts) return

    const ok = window.confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")
    if (!ok) return
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
      alert("No se pudo eliminar el producto. Intente de nuevo.")
    } finally {
      setDeletingId(null)
    }
  }

  async function duplicateProduct(id: string) {
    if (!canDuplicateProducts) return

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
      alert("No se pudo duplicar el producto. Intente de nuevo.")
    } finally {
      setDuplicatingId(null)
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function renderSensitiveColumnsToggle() {
    const label = showSensitiveColumns ? "Ocultar columnas sensibles" : "Mostrar columnas sensibles"

    return (
      <th className="text-right">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setShowSensitiveColumns((prev) => !prev)}
          title={label}
          aria-label={label}
        >
          {showSensitiveColumns ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </th>
    )
  }

  function ProductRow({ p }: { p: SerializedProduct }) {
    return (
      <tr key={p.id}>
        <td className="text-xs text-base-content/60">
          {canEditField("createdAt") && isEditing(p.id, "createdAt") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="date"
                value={getEditingValue(p.id, "createdAt")}
                onChange={(e) => updateEditingValue(p.id, "createdAt", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "createdAt")
                  if (e.key === "Escape") cancelEditField(p.id, "createdAt")
                }}
                onBlur={() => commitEditField(p.id, "createdAt")}
                className="input input-xs w-full min-w-[120px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "createdAt"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "createdAt")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "createdAt")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "createdAt", p.createdAt ? toArgDateInputValue(new Date(p.createdAt)) : "")}>
              <div
                className="tooltip tooltip-right"
                data-tip={p.createdAt ? formatInTimeZone(new Date(p.createdAt), AR_TIME_ZONE, "dd/MM/yyyy HH:mm") : ""}
              >
                <span className="underline decoration-dotted cursor-help">
                  {p.createdAt ? formatInTimeZone(new Date(p.createdAt), AR_TIME_ZONE, "dd/MM") : "-"}
                </span>
              </div>
            </span>
          )}
        </td>

        {visibleOriginColumn ? (
          <td>
            {canEditField("origin") && isEditing(p.id, "origin") ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={getEditingValue(p.id, "origin")}
                  onChange={(e) => updateEditingValue(p.id, "origin", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "origin")
                    if (e.key === "Escape") cancelEditField(p.id, "origin")
                  }}
                  onBlur={() => commitEditField(p.id, "origin")}
                  className="input input-xs w-full min-w-[100px]"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "origin"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "origin")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "origin")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "origin", p.origin)}>
                {p.origin || "-"}
              </span>
            )}
          </td>
        ) : null}

        {visibleLocationColumn ? (
          <td>
            {canEditField("location") && isEditing(p.id, "location") ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={getEditingValue(p.id, "location")}
                  onChange={(e) => updateEditingValue(p.id, "location", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "location")
                    if (e.key === "Escape") cancelEditField(p.id, "location")
                  }}
                  onBlur={() => commitEditField(p.id, "location")}
                  className="input input-xs w-full min-w-[100px]"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "location"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "location")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "location")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "location", p.location)}>
                {p.location || "-"}
              </span>
            )}
          </td>
        ) : null}

        {visibleImeiColumn ? (
          <td>
            {canEditField("imei") && isEditing(p.id, "imei") ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={getEditingValue(p.id, "imei")}
                  onChange={(e) => updateEditingValue(p.id, "imei", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "imei")
                    if (e.key === "Escape") cancelEditField(p.id, "imei")
                  }}
                  onBlur={() => commitEditField(p.id, "imei")}
                  className="input input-xs w-full min-w-[100px]"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "imei"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "imei")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "imei")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "imei", p.imei)}>
                {p.imei || "-"}
              </span>
            )}
          </td>
        ) : null}

        <td>
          {canEditField("modelName") && isEditing(p.id, "modelName") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={getEditingValue(p.id, "modelName")}
                onChange={(e) => updateEditingValue(p.id, "modelName", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "modelName")
                  if (e.key === "Escape") cancelEditField(p.id, "modelName")
                }}
                onBlur={() => commitEditField(p.id, "modelName")}
                className="input input-xs w-full min-w-[120px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "modelName"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "modelName")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "modelName")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "modelName", p.modelName)}>
              {p.notes ? (
                <div className="tooltip tooltip-bottom" data-tip={p.notes ?? ""}>
                  <span className="underline decoration-dotted">{p.modelName}</span>
                </div>
              ) : (
                p.modelName
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("batteryPct") && isEditing(p.id, "batteryPct") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                max={100}
                value={getEditingValue(p.id, "batteryPct")}
                onChange={(e) => updateEditingValue(p.id, "batteryPct", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "batteryPct")
                  if (e.key === "Escape") cancelEditField(p.id, "batteryPct")
                }}
                onBlur={() => commitEditField(p.id, "batteryPct")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "batteryPct"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "batteryPct")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "batteryPct")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "batteryPct", p.batteryPct)}>
              {p.batteryPct != null ? (
                <>
                  {p.batteryPct}
                  <span className="text-xs text-base-content/50"> %</span>
                </>
              ) : (
                "-"
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("color") && isEditing(p.id, "color") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={getEditingValue(p.id, "color")}
                onChange={(e) => updateEditingValue(p.id, "color", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "color")
                  if (e.key === "Escape") cancelEditField(p.id, "color")
                }}
                onBlur={() => commitEditField(p.id, "color")}
                className="input input-xs w-full min-w-[80px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "color"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "color")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "color")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "color", p.color)}>
              {p.color ?? "-"}
            </span>
          )}
        </td>

        <td>
          {canEditField("capacityGB") && isEditing(p.id, 'capacityGB') ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                name="capacityGB"
                value={getEditingValue(p.id, 'capacityGB')}
                onChange={(e) => updateEditingValue(p.id, 'capacityGB', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditField(p.id, 'capacityGB')
                  if (e.key === 'Escape') cancelEditField(p.id, 'capacityGB')
                }}
                onBlur={() => commitEditField(p.id, 'capacityGB')}
                className="select select-xs w-24"
                disabled={savingField?.productId === p.id && savingField?.fieldName === 'capacityGB'}
              >
                <option value="">Seleccionar</option>
                <option value="64">64 GB</option>
                <option value="128">128 GB</option>
                <option value="256">256 GB</option>
                <option value="512">512 GB</option>
                <option value="1024">1024 GB (1 TB)</option>
                <option value="2048">2048 GB (2 TB)</option>
              </select>
              <div className='flex flex-col join join-horizontal border border-base-content/10'>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'capacityGB')}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'capacityGB')}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "capacityGB", p.capacityGB)}>
              {(p.capacityGB != null) ? (
                <>
                  {p.capacityGB}<span className="text-xs text-base-content/50"> GB</span>
                </>
              ) : (
                '-'
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("condition") && isEditing(p.id, "condition") ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                value={getEditingValue(p.id, "condition")}
                onChange={(e) => updateEditingValue(p.id, "condition", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "condition")
                  if (e.key === "Escape") cancelEditField(p.id, "condition")
                }}
                onBlur={() => commitEditField(p.id, "condition")}
                className="select select-xs w-full min-w-[100px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "condition"}
              >
                <option value="">-</option>
                {conditionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {conditionLabelMap[opt] ?? opt}
                  </option>
                ))}
              </select>
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "condition")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "condition")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "condition", p.condition)}>
              {p.condition == null ? "-" : conditionLabelMap[p.condition] ?? p.condition}
            </span>
          )}
        </td>

        {visibleCostColumn ? (
          <td>
            {canEditField("costPrice") && isEditing(p.id, "costPrice") ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">$ </span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min={0}
                  value={getEditingValue(p.id, "costPrice")}
                  onChange={(e) => updateEditingValue(p.id, "costPrice", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "costPrice")
                    if (e.key === "Escape") cancelEditField(p.id, "costPrice")
                  }}
                  onBlur={() => commitEditField(p.id, "costPrice")}
                  className="input input-xs w-24"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "costPrice"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "costPrice")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "costPrice")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "costPrice", p.costPrice)}>
                <span className="text-xs text-base-content/50">$ </span>
                {formatDecimal((p as any).costPrice)}
              </span>
            )}
          </td>
        ) : null}

        {canSeeSalePrice ? (
          <td>
            {canEditField("salePrice") && isEditing(p.id, "salePrice") ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">$ </span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min={0}
                  value={getEditingValue(p.id, "salePrice")}
                  onChange={(e) => updateEditingValue(p.id, "salePrice", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "salePrice")
                    if (e.key === "Escape") cancelEditField(p.id, "salePrice")
                  }}
                  onBlur={() => commitEditField(p.id, "salePrice")}
                  className="input input-xs w-24"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "salePrice"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "salePrice")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "salePrice")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "salePrice", p.salePrice)}>
                <span className="text-xs text-base-content/50">$ </span>
                {formatDecimal((p as any).salePrice)}
              </span>
            )}
          </td>
        ) : null}

        <td>
          {canEditField("stockInitial") && isEditing(p.id, "stockInitial") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                step={1}
                value={getEditingValue(p.id, "stockInitial")}
                onChange={(e) => updateEditingValue(p.id, "stockInitial", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "stockInitial")
                  if (e.key === "Escape") cancelEditField(p.id, "stockInitial")
                }}
                onBlur={() => commitEditField(p.id, "stockInitial")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "stockInitial"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button
                  className="btn btn-ghost btn-xs join-item"
                  onClick={() => commitEditField(p.id, "stockInitial")}
                >
                  <CheckIcon className="h-[1em]" />
                </button>
                <button
                  className="btn btn-ghost btn-xs join-item"
                  onClick={() => cancelEditField(p.id, "stockInitial")}
                >
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "stockInitial", p.stockInitial)}>
              {p.stockInitial}
            </span>
          )}
        </td>

        <td>
          {canEditField("stock") && isEditing(p.id, "stock") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                step={1}
                value={getEditingValue(p.id, "stock")}
                onChange={(e) => updateEditingValue(p.id, "stock", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "stock")
                  if (e.key === "Escape") cancelEditField(p.id, "stock")
                }}
                onBlur={() => commitEditField(p.id, "stock")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "stock")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "stock")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {canEditStock ? (
                <div className="flex flex-row btn-group gap-1 items-center">
                  <button
                    className="btn btn-ghost btn-xs"
                    aria-label="decrement stock"
                    disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
                    onClick={() => changeStockBy(p.id, -1)}
                  >
                    ▼
                  </button>
                  <span
                    className="cursor-pointer hover:bg-base-200 rounded px-1"
                    onClick={() => startEditStock(p.id, p.stock)}
                    title="Click para editar"
                  >
                    {p.stock}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    aria-label="increment stock"
                    disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
                    onClick={() => changeStockBy(p.id, 1)}
                  >
                    ▲
                  </button>
                </div>
              ) : (
                <span>{p.stock}</span>
              )}
            </div>
          )}
        </td>

        <td>
          {canEditState ? (
            <div className="dropdown dropdown-start relative">
              <div
                tabIndex={0}
                role="button"
                className="flex flex-row flex-nowrap gap-2 items-center cursor-pointer btn btn-xs btn-ghost py-2"
              >
                <span className={`badge badge-sm ${stateColorMap[p.state] ?? "badge-ghost"}`}>{p.state}</span>
                <ChevronDownIcon className="h-4 w-4" />
              </div>
              <ul tabIndex={-1} className="fixed dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 !z-[1000]">
                {stateOptions.map((s) => (
                  <li key={s} className="py-2 flex flex-row items-center gap-2">
                    <button
                      className={`w-full text-left btn btn-ghost btn-xs justify-start ${stateColorMap[s] ?? ""}`}
                      disabled={savingStateId === p.id}
                      onClick={() => changeState(p.id, s)}
                    >
                      {s}
                      <div className={`w-2 h-2 rounded-full border ${stateColorMap[s] ?? ""}`}></div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <span className={`badge badge-sm ${stateColorMap[p.state] ?? "badge-ghost"}`}>{p.state}</span>
          )}
        </td>

        {hasProductActions ? (
          <td className="flex items-center gap-2">
            {canEditProducts ? (
              <Link href={`/dashboard/products/${p.id}/edit`} className="btn btn-xs btn-square btn-soft">
                <PencilIcon className="size-[1.2em]" />
              </Link>
            ) : null}

            {canDuplicateProducts ? (
              <button
                className="btn btn-xs btn-square btn-soft"
                onClick={() => duplicateProduct(p.id)}
                disabled={duplicatingId === p.id}
                title="Duplicar producto"
              >
                {duplicatingId === p.id ? (
                  <span className="loading loading-bars loading-xs"></span>
                ) : (
                  <DocumentDuplicateIcon className="size-[1.2em]" />
                )}
              </button>
            ) : null}

            {canDeleteProducts ? (
              <button
                className="btn btn-xs btn-square btn-soft btn-error"
                onClick={() => deleteProduct(p.id)}
                disabled={deletingId === p.id}
                aria-disabled={deletingId === p.id}
                title="Eliminar producto"
              >
                {deletingId === p.id ? <span className="loading loading-bars loading-xs"></span> : <TrashIcon className="size-[1.2em]" />}
              </button>
            ) : null}
          </td>
        ) : null}
        <td></td>
      </tr>
    )
  }

  const hasNext = !!data?.nextCursor

  // --- UI ---
  return (
    <div className="flex flex-col gap-4 !h-full flex-1 relative">
      <div className="flex justify-between items-center">
        <div className="flex flex-row items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">
            Productos
          </h2>

          <div className="flex flex-wrap gap-4 rounded-box bg-base-200 p-2 items-center">
            {viewMode === "DETAIL" ? (
              <div className="flex flex-row items-center gap-1">
                <span className="ml-1 text-sm text-base-content/60">Resultados {filteredProducts.length}</span>
                <span className="ml-1 text-sm text-base-content/30">de</span>
                <span className="ml-1 text-sm text-base-content/30">{totalProducts}</span>
              </div>
            ) : (
              <div className="flex flex-row items-center gap-1">
                <span className="ml-1 text-sm text-base-content/60">Grupos {groupedCounts.groups}</span>
                <span className="ml-1 text-sm text-base-content/30">| Items {groupedCounts.instances}</span>
                <span className="ml-1 text-sm text-base-content/30">| Stock {groupedCounts.totalStock}</span>
                <span className="ml-1 text-sm text-base-content/30">| Disp. {groupedCounts.totalAvail}</span>
              </div>
            )}

            <div className="divider divider-horizontal mx-0" />
            <div className="ml-2 flex items-center gap-2">
              <div className="join border-[0.1em] border-base-content/10">
                <button
                  type="button"
                  className={`join-item btn btn-sm ${viewMode === "DETAIL" ? "btn-active" : ""}`}
                  onClick={() => setViewMode("DETAIL")}
                  title="Detalle de Stock"
                >
                  Detalle
                </button>
                <div className="divider divider-horizontal mx-[-4px]"></div>
                <button
                  type="button"
                  className={`join-item btn btn-sm ${viewMode === "GENERAL" ? "btn-active" : ""}`}
                  onClick={() => setViewMode("GENERAL")}
                  title="Stock General"
                >
                  General
                </button>
              </div>
            </div>

            <div className="ml-2 flex items-center gap-2">
              <div className="join border-[0.1em] border-base-content/10 ">
                <button
                  type="button"
                  className={`join-item btn btn-sm ${typeFilter === "PHONE" ? "btn-active" : ""}`}
                  onClick={() => setTypeFilter(typeFilter === "PHONE" ? "" : "PHONE")}
                >
                  Teléfonos
                </button>
                <div className="divider divider-horizontal mx-[-4px]"></div>
                <button
                  type="button"
                  className={`join-item btn btn-sm ${typeFilter === "ACCESSORY" ? "btn-active" : ""}`}
                  onClick={() => setTypeFilter(typeFilter === "ACCESSORY" ? "" : "ACCESSORY")}
                >
                  Accesorios
                </button>
              </div>
              {typeFilter ? (
                <button className="btn btn-ghost btn-xs" onClick={() => setTypeFilter("")}>
                  ✕
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-outline border border-base-content/10 h-[2.4em] flex items-center"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              title={isTableExpanded ? "Contraer tabla" : "Expandir tabla"}
            >
              {isTableExpanded ? "Comprimir" : "Expandir "} Tabla
              {isTableExpanded ? <ArrowsPointingInIcon className="size-6" /> : <ArrowsPointingOutIcon className="size-6" />}
            </button>

            <button
              type="button"
              className="btn btn-sm btn-ghost border border-base-content/10"
              onClick={() => mutate()}
              title="Refrescar"
            >
              {isLoading ? <span className="loading loading-spinner loading-xs"></span> : "Refrescar"}
            </button>
          </div>
        </div>

        {canCreateProducts ? (
          <div className="flex items-center gap-2">
            <Link href="/dashboard/products/new" className="btn btn-primary">
              Nuevo Producto
            </Link>
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>Error cargando productos: {String((error as any)?.message ?? error)}</span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 h-auto">
        <div className="flex flex-grow flex-wrap gap-4 rounded-box bg-base-200 p-2 items-center">
          <SearchBar placeholder="Buscar por modelo..." onSearch={setSearch} search={search} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDrawerOpen(true)}>
            <FunnelIcon className="w-5 h-5" />
            Filtros
          </button>
          <select
            className="select select-bordered select-sm"
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
            className="select select-bordered select-sm"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {stateLabelMap[s] ?? s}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearFilters()}>
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
      <div className="flex items-center gap-4">
        {(brandFilter || conditionFilter || colorFilter || capacityFilter || stateFilter || batteryMin || batteryMax) && (
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
            {stateFilter && (
              <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                Estado: {stateLabelMap[stateFilter]}
                <button type="button" className="btn btn-ghost btn-xs btn-circle ml-1" onClick={() => setStateFilter("")}>
                  ✕
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

      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 h-[70dvh]">
        {isLoading && productsLocal.length === 0 ? (
          <div className="p-6">
            <div className="skeleton h-6 w-64 mb-3"></div>
            <div className="skeleton h-40 w-full"></div>
          </div>
        ) : viewMode === "DETAIL" ? (
          <table className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? "" : "table-xs"}`}>
            <thead>
              <tr>
                <th>Agregado</th>
                {visibleOriginColumn ? <th>Origen</th> : null}
                {visibleLocationColumn ? <th>Ubicación</th> : null}
                {visibleImeiColumn ? <th>IMEI</th> : null}
                <th>Modelo</th>
                <th>Bateria %</th>
                <th>Color</th>
                <th>Capacidad (GB)</th>
                <th>Condición</th>
                {visibleCostColumn ? <th>Costo (USD)</th> : null}
                {canSeeSalePrice ? <th>Precio Venta (USD)</th> : null}
                <th>Stock Inicial</th>
                <th>Stock</th>
                <th>Estado</th>
                {hasProductActions ? <th>Acciones</th> : null}
                {renderSensitiveColumnsToggle()}
              </tr>
            </thead>
            <tbody key="filtered-products" className="h-full">
              {filteredProducts.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        ) : (
          <table className={`table table-zebra w-full table-pin-rows ${isTableExpanded ? "" : "table-xs"}`}>
            <thead>
              <tr>
                <th className="w-[40px]"></th>
                <th>Modelo</th>
                <th>Items</th>
                <th>Stock</th>
                <th>Disponible</th>
                {visibleCostColumn ? <th>Costo (USD)</th> : null}
                {canSeeSalePrice ? <th>Precio Venta (USD)</th> : null}
                <th className="text-right">Último agregado</th>
                {renderSensitiveColumnsToggle()}
              </tr>
            </thead>
            <tbody className="h-full">
              {grouped.map((g) => {
                const isOpen = !!expandedGroups[g.key]
                const last = g.newest ? formatInTimeZone(new Date(g.newest), AR_TIME_ZONE, "dd/MM HH:mm") : "-"
                const costLabel = rangeLabelFromItems(g.items, "costPrice")
                const saleLabel = rangeLabelFromItems(g.items, "salePrice")

                return (
                  <React.Fragment key={g.key}>
                    <tr
                      key={`group-${g.key}`}
                      className="cursor-pointer hover:bg-base-200/50"
                      onClick={() => toggleGroup(g.key)}
                      title="Click para expandir/contraer"
                    >
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleGroup(g.key)
                          }}
                          aria-label={isOpen ? "collapse group" : "expand group"}
                        >
                          <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                      <td className="font-semibold">{g.label}</td>
                      <td>
                        <span className="badge badge-sm badge-ghost">{g.items.length}</span>
                      </td>
                      <td>{g.stockSum}</td>
                      <td>{g.availSum}</td>
                      {visibleCostColumn ? (
                        <td>
                          <span className="text-xs text-base-content/50">$ </span>
                          {costLabel}
                        </td>
                      ) : null}
                      {canSeeSalePrice ? (
                        <td>
                          <span className="text-xs text-base-content/50">$ </span>
                          {saleLabel}
                        </td>
                      ) : null}
                      <td className="text-right text-xs text-base-content/60">{last}</td>
                      <td></td>
                    </tr>

                    {isOpen ? (
                      <tr key={`group-body-${g.key}`}>
                        <td colSpan={generalColumnCount} className="p-0">
                          <div className="bg-base-100 border-t border-base-content/5">
                            <div className="px-3 py-2 text-xs text-base-content/60 flex items-center justify-between">
                              <span>
                                Detalle de <span className="font-semibold">{g.label}</span> — {g.items.length} items (filtrados)
                              </span>
                              <button className="btn btn-ghost btn-xs" onClick={() => toggleGroup(g.key)}>
                                Cerrar
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className={`table table-zebra w-full ${isTableExpanded ? "" : "table-xs"}`}>
                                <thead>
                                  <tr>
                                    <th>Agregado</th>
                                    {visibleLocationColumn ? <th>Ubicación</th> : null}
                                    {visibleImeiColumn ? <th>IMEI</th> : null}
                                    <th>Modelo</th>
                                    <th>Bateria %</th>
                                    <th>Color</th>
                                    <th>Capacidad (GB)</th>
                                    <th>Condición</th>
                                    {visibleCostColumn ? <th>Costo (USD)</th> : null}
                                    {canSeeSalePrice ? <th>Precio Venta (USD)</th> : null}
                                    <th>Stock Inicial</th>
                                    <th>Stock</th>
                                    <th>Estado</th>
                                    {hasProductActions ? <th>Acciones</th> : null}
                                    {renderSensitiveColumnsToggle()}
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.items
                                    .slice()
                                    .sort((a, b) => newestCreatedAt([b]) - newestCreatedAt([a]))
                                    .map((p) => (
                                      <ProductRow key={p.id} p={p} />
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
