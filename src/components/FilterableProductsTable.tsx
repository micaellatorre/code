"use client"

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, FunnelIcon, CheckIcon, XMarkIcon, ChevronDownIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid'

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
  stockInitial: number
  stock: number
  stockAvailable: number
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
  // Generic editing state: { productId: { fieldName: value } }
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, string>>>({})
  const [savingField, setSavingField] = useState<{ productId: string; fieldName: string } | null>(null)
  const [savingStateId, setSavingStateId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  function startEditField(productId: string, fieldName: string, currentValue: any) {
    setEditingFields((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [fieldName]: currentValue == null ? '' : String(currentValue),
      },
    }))
  }

  function cancelEditField(productId: string, fieldName: string) {
    setEditingFields((prev) => {
      const updated = { ...prev }
      if (updated[productId]) {
        const productFields = { ...updated[productId] }
        delete productFields[fieldName]
        if (Object.keys(productFields).length === 0) {
          delete updated[productId]
        } else {
          updated[productId] = productFields
        }
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

  async function persistFieldUpdate(productId: string, fieldName: string, value: any) {
    setSavingField({ productId, fieldName })
    try {
      const updateBody: any = { [fieldName]: value }

      // Special handling for stock - also update stockAvailable
      if (fieldName === 'stock') {
        const product = productsLocal.find((p) => p.id === productId)
        if (product) {
          const delta = Number(value) - (product.stock ?? 0)
          const newStockAvailable = Math.max(0, (product.stockAvailable ?? 0) + delta)
          updateBody.stockAvailable = newStockAvailable
        }
      }

      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      })
      if (!res.ok) throw new Error('server error')
      const updated = await res.json()

      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
              ...p,
              [fieldName]: updated[fieldName] ?? p[fieldName as keyof SerializedProduct],
              ...(fieldName === 'stock' && updated.stockAvailable !== undefined
                ? { stockAvailable: updated.stockAvailable }
                : {}),
            }
            : p,
        ),
      )

      // Clear editing state
      cancelEditField(productId, fieldName)
    } catch (err) {
      const original = products.find((p) => p.id === productId)
      if (original) {
        setProductsLocal((prev) => prev.map((p) => (p.id === productId ? original : p)))
      }
      console.error(`Failed to persist ${fieldName} update`, err)
    } finally {
      setSavingField(null)
    }
  }

  function commitEditField(productId: string, fieldName: string) {
    const editingValue = editingFields[productId]?.[fieldName]
    if (editingValue === undefined) return

    const product = productsLocal.find((p) => p.id === productId)
    if (!product) return

    let processedValue: any = editingValue.trim() === '' ? null : editingValue.trim()

    // Type-specific processing
    if (['capacityGB', 'batteryPct'].includes(fieldName)) {
      if (processedValue === null || processedValue === '') {
        processedValue = null
      } else {
        const num = parseInt(processedValue, 10)
        if (Number.isNaN(num) || num < 0) return
        if (fieldName === 'batteryPct' && num > 100) return
        processedValue = num
      }
    } else if (['stock', 'stockInitial', 'stockAvailable'].includes(fieldName)) {
      const num = parseInt(processedValue || '0', 10)
      if (Number.isNaN(num) || num < 0) return
      processedValue = num
    } else if (['costPrice', 'salePrice'].includes(fieldName)) {
      const num = parseFloat(processedValue || '0')
      if (!Number.isFinite(num) || num < 0) return
      processedValue = num
    } else if (fieldName === 'shippingCost') {
      if (processedValue === null || processedValue === '') {
        processedValue = null
      } else {
        const num = parseFloat(processedValue)
        if (!Number.isFinite(num) || num < 0) return
        processedValue = num
      }
    } else if (['imei', 'color', 'brand', 'notes'].includes(fieldName)) {
      // For nullable string fields, empty string becomes null
      processedValue = processedValue === '' ? null : processedValue
    }

    // Optimistic update
    setProductsLocal((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
            ...p,
            [fieldName]: processedValue,
            ...(fieldName === 'stock'
              ? {
                stockAvailable: Math.max(
                  0,
                  (p.stockAvailable ?? 0) + (processedValue - (p.stock ?? 0)),
                ),
              }
              : {}),
          }
          : p,
      ),
    )

    persistFieldUpdate(productId, fieldName, processedValue)
  }

  function isEditing(productId: string, fieldName: string): boolean {
    return editingFields[productId]?.[fieldName] !== undefined
  }

  function getEditingValue(productId: string, fieldName: string): string {
    return editingFields[productId]?.[fieldName] ?? ''
  }

  // Legacy functions for stock arrows (keep for backwards compatibility)
  async function persistStockUpdate(id: string, newStock: number, newStockAvailable?: number) {
    setSavingField({ productId: id, fieldName: "stock" });
    // Snapshot para rollback si falla
    const original = products.find((p) => p.id === id);

    // 🎯 (Opcional) Optimistic UI: estimamos el nextState para evitar parpadeos
    // Si no te interesa optimista, puedes quitar este bloque y dejar que sólo el response mande el estado
    const optimisticNext = (() => {
      if (!original) return null;
      const prevState = original.state;
      if (newStock < 1 && prevState !== "FUERA_DE_STOCK") return "FUERA_DE_STOCK";
      if (newStock >= 1 && prevState === "FUERA_DE_STOCK") return "EN_STOCK";
      return prevState;
    })();

    // Aplicamos optimista de stock + state
    if (original) {
      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              stock: newStock,
              stockAvailable:
                newStockAvailable !== undefined ? newStockAvailable : p.stockAvailable,
              state: optimisticNext ?? p.state,
            }
            : p
        )
      );
    }

    try {
      const updateBody: { stock: number; stockAvailable?: number } = { stock: newStock };
      if (newStockAvailable !== undefined) {
        updateBody.stockAvailable = newStockAvailable;
      }
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());

      // 🔁 Aseguramos sincronizar lo que diga el servidor (incluye `state`)
      const updated = await res.json();
      setProductsLocal((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              stock: updated.stock,
              stockAvailable:
                updated.stockAvailable ?? p.stockAvailable,
              state: updated.state, // 👈 aquí está la clave
            }
            : p
        )
      );
    } catch (err) {
      // Rollback a original
      if (original) {
        setProductsLocal((prev) => prev.map((p) => (p.id === id ? original : p)));
      }
      console.error("Failed to persist stock update", err);
    } finally {
      setSavingField(null);
    }
  }


  function startEditStock(id: string, value: number) {
    startEditField(id, 'stock', value)
  }

  function changeStockBy(id: string, delta: number) {
    const p = productsLocal.find((x) => x.id === id)
    if (!p) return
    const newStock = Math.max(0, (p.stock ?? 0) + delta)
    const newStockAvailable = Math.max(0, (p.stockAvailable ?? 0) + delta)
    // optimistic
    setProductsLocal((prev) =>
      prev.map((prod) =>
        prod.id === id
          ? { ...prod, stock: newStock, stockAvailable: newStockAvailable }
          : prod,
      ),
    )
    persistStockUpdate(id, newStock, newStockAvailable)
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
    <div className="flex flex-col gap-4 !h-full flex-1 relative">
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
          <div className="ml-2 flex items-center gap-2">
            <div className="join border-[0.1em] border-base-content/10 ">
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
              <button className="btn btn-ghost btn-xs" onClick={() => setTypeFilter('')}>✕</button>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-outline border border-base-content/10 h-[2.4em] flex items-center"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            title={isTableExpanded ? 'Contraer tabla' : 'Expandir tabla'}
          >
            {isTableExpanded ? 'Comprimir' : 'Expandir '} Tabla
            {isTableExpanded ? (
              <ArrowsPointingInIcon className="size-6" />
            ) : (
              <ArrowsPointingOutIcon className="size-6" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/new" className="btn btn-primary">
            Nuevo Producto
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 h-auto">
        <div className="flex items-center gap-2 flex-1">
          <SearchBar
            placeholder="Buscar por modelo..."
            onSearch={setSearch}
            search={search}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setDrawerOpen(true)}
          >
            <FunnelIcon className="w-5 h-5" />
            Filtros
          </button>
          {/* Add a chip for each activeFilters */}
          {(brandFilter || conditionFilter || colorFilter || capacityFilter || stateFilter || batteryMin || batteryMax) &&
            <div className="flex items-center gap-2">
              {brandFilter && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Marca: {brandFilter}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => setBrandFilter('')}
                  >
                    ✕
                  </button>
                </span>
              )}
              {conditionFilter && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Condición: {conditionLabelMap[conditionFilter]}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => setConditionFilter('')}
                  >
                    ✕
                  </button>
                </span>
              )}
              {colorFilter && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Color: {colorFilter}
                  <button

                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => setColorFilter('')}
                  >
                    ✕
                  </button>
                </span>
              )}
              {capacityFilter && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Capacidad: {capacityFilter} GB
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => setCapacityFilter('')}
                  >
                    ✕
                  </button>
                </span>
              )}
              {stateFilter && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Estado: {stateLabelMap[stateFilter]}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => setStateFilter('')}
                  >
                    ✕
                  </button>
                </span>
              )}
              {(batteryMin || batteryMax) && (
                <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
                  Batería: {batteryMin ? `Min ${batteryMin}%` : ''}{batteryMin && batteryMax ? ' - ' : ''}{batteryMax ? `Max ${batteryMax}%` : ''}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle ml-1"
                    onClick={() => {
                      setBatteryMin('')
                      setBatteryMax('')
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          }
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => clearFilters()}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Drawer for filters - positioned fixed to overlay content */}
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
                <button
                  type="button"
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={() => setDrawerOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Condition Filter */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Condición</span>
                  </label>
                  <select
                    value={conditionFilter}
                    onChange={(e) => setConditionFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
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
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={() => setConditionFilter('')}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Battery Range */}
                <div className="form-control">
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
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={() => {
                        setBatteryMin('')
                        setBatteryMax('')
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Color Filter */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Color</span>
                  </label>
                  <select
                    value={colorFilter}
                    onChange={(e) => setColorFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="">Todos los colores</option>
                    {colors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {colorFilter && (
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={() => setColorFilter('')}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Capacity Filter */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Capacidad (GB)</span>
                  </label>
                  <select
                    value={capacityFilter}
                    onChange={(e) => setCapacityFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="">Todas las capacidades</option>
                    {capacities.map((cap) => (
                      <option key={cap} value={String(cap)}>
                        {cap} GB
                      </option>
                    ))}
                  </select>
                  {capacityFilter && (
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={() => setCapacityFilter('')}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* State Filter */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Estado</span>
                  </label>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="">Todos los estados</option>
                    {stateOptions.map((s) => (
                      <option key={s} value={s}>
                        {stateLabelMap[s] ?? s}
                      </option>
                    ))}
                  </select>
                  {stateFilter && (
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={() => setStateFilter('')}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Clear All Filters */}
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
        <table className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? '' : 'table-xs'}`}>
          <thead>
            <tr>
              <th>Agregado</th>
              <th>Modelo</th>
              <th>IMEI</th>
              <th>Bateria %</th>
              <th>Color</th>
              <th>Capacidad (GB)</th>
              <th>Condición</th>
              <th>Costo (USD)</th>
              <th>Precio Venta (USD)</th>
              <th>Stock Inicial</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody className='h-full'>
            {filteredProducts.map((p) => (
              <tr key={p.id}>
                <td className='text-xs text-base-content/60'>
                  {isEditing(p.id, 'createdAt') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="date"
                        value={getEditingValue(p.id, 'createdAt')}
                        onChange={(e) => updateEditingValue(p.id, 'createdAt', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'createdAt')
                          if (e.key === 'Escape') cancelEditField(p.id, 'createdAt')
                        }}
                        onBlur={() => commitEditField(p.id, 'createdAt')}
                        className="input input-xs w-full min-w-[120px]"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'createdAt'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'createdAt')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'createdAt')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'createdAt', p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '')}
                      title="Click para editar">
                      <div className='tooltip tooltip-right' data-tip={p.createdAt ? new Date(p.createdAt).toLocaleString('es-AR') : ''}>
                        <span className="underline decoration-dotted cursor-help">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                          }) : '-'}
                        </span>
                      </div>
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'modelName') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={getEditingValue(p.id, 'modelName')}
                        onChange={(e) => updateEditingValue(p.id, 'modelName', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'modelName')
                          if (e.key === 'Escape') cancelEditField(p.id, 'modelName')
                        }}
                        onBlur={() => commitEditField(p.id, 'modelName')}
                        className="input input-xs w-full min-w-[120px]"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'modelName'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'modelName')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'modelName')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'modelName', p.modelName)}
                      title="Click para editar"
                    >
                      {p.notes ? (
                        <div className="tooltip tooltip-bottom" data-tip={p.notes ?? ''}>
                          <span className="underline decoration-dotted">
                            {p.modelName}
                          </span>
                        </div>
                      ) : (
                        p.modelName
                      )}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'imei') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={getEditingValue(p.id, 'imei')}
                        onChange={(e) => updateEditingValue(p.id, 'imei', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'imei')
                          if (e.key === 'Escape') cancelEditField(p.id, 'imei')
                        }}
                        onBlur={() => commitEditField(p.id, 'imei')}
                        className="input input-xs w-full min-w-[100px]"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'imei'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'imei')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'imei')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'imei', p.imei)}
                      title="Click para editar"
                    >
                      {p.imei || '-'}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'batteryPct') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        max={100}
                        value={getEditingValue(p.id, 'batteryPct')}
                        onChange={(e) => updateEditingValue(p.id, 'batteryPct', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'batteryPct')
                          if (e.key === 'Escape') cancelEditField(p.id, 'batteryPct')
                        }}
                        onBlur={() => commitEditField(p.id, 'batteryPct')}
                        className="input input-xs w-20"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'batteryPct'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'batteryPct')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'batteryPct')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'batteryPct', p.batteryPct)}
                      title="Click para editar"
                    >
                      {p.batteryPct != null ? (
                        <>
                          {p.batteryPct}<span className="text-xs text-base-content/50"> %</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'color') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={getEditingValue(p.id, 'color')}
                        onChange={(e) => updateEditingValue(p.id, 'color', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'color')
                          if (e.key === 'Escape') cancelEditField(p.id, 'color')
                        }}
                        onBlur={() => commitEditField(p.id, 'color')}
                        className="input input-xs w-full min-w-[80px]"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'color'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'color')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'color')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'color', p.color)}
                      title="Click para editar"
                    >
                      {p.color ?? '-'}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'capacityGB') ? (
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
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'capacityGB', p.capacityGB)}
                      title="Click para editar"
                    >
                      {p.capacityGB != null ? (
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
                  {isEditing(p.id, 'condition') ? (
                    <div className="flex items-center gap-2">
                      <select
                        autoFocus
                        value={getEditingValue(p.id, 'condition')}
                        onChange={(e) => updateEditingValue(p.id, 'condition', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'condition')
                          if (e.key === 'Escape') cancelEditField(p.id, 'condition')
                        }}
                        onBlur={() => commitEditField(p.id, 'condition')}
                        className="select select-xs w-full min-w-[100px]"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'condition'}
                      >
                        <option value="">-</option>
                        {conditionOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {conditionLabelMap[opt] ?? opt}
                          </option>
                        ))}
                      </select>
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'condition')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'condition')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'condition', p.condition)}
                      title="Click para editar"
                    >
                      {p.condition == null ? '-' : conditionLabelMap[p.condition] ?? p.condition}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'costPrice') ? (
                    <div className="flex items-center gap-2">
                      <span className='text-xs text-base-content/50'>$ </span>
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min={0}
                        value={getEditingValue(p.id, 'costPrice')}
                        onChange={(e) => updateEditingValue(p.id, 'costPrice', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'costPrice')
                          if (e.key === 'Escape') cancelEditField(p.id, 'costPrice')
                        }}
                        onBlur={() => commitEditField(p.id, 'costPrice')}
                        className="input input-xs w-24"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'costPrice'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'costPrice')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'costPrice')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'costPrice', p.costPrice)}
                      title="Click para editar"
                    >
                      <span className='text-xs text-base-content/50'>$ </span>{formatDecimal((p as any).costPrice)}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'salePrice') ? (
                    <div className="flex items-center gap-2">
                      <span className='text-xs text-base-content/50'>$ </span>
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min={0}
                        value={getEditingValue(p.id, 'salePrice')}
                        onChange={(e) => updateEditingValue(p.id, 'salePrice', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'salePrice')
                          if (e.key === 'Escape') cancelEditField(p.id, 'salePrice')
                        }}
                        onBlur={() => commitEditField(p.id, 'salePrice')}
                        className="input input-xs w-24"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'salePrice'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'salePrice')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'salePrice')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'salePrice', p.salePrice)}
                      title="Click para editar"
                    >
                      <span className='text-xs text-base-content/50'>$ </span>{formatDecimal((p as any).salePrice)}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'stockInitial') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        step={1}
                        value={getEditingValue(p.id, 'stockInitial')}
                        onChange={(e) => updateEditingValue(p.id, 'stockInitial', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'stockInitial')
                          if (e.key === 'Escape') cancelEditField(p.id, 'stockInitial')
                        }}
                        onBlur={() => commitEditField(p.id, 'stockInitial')}
                        className="input input-xs w-20"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'stockInitial'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'stockInitial')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'stockInitial')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-base-200 rounded px-1"
                      onClick={() => startEditField(p.id, 'stockInitial', p.stockInitial)}
                      title="Click para editar"
                    >
                      {p.stockInitial}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing(p.id, 'stock') ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        step={1}
                        value={getEditingValue(p.id, 'stock')}
                        onChange={(e) => updateEditingValue(p.id, 'stock', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditField(p.id, 'stock')
                          if (e.key === 'Escape') cancelEditField(p.id, 'stock')
                        }}
                        onBlur={() => commitEditField(p.id, 'stock')}
                        className="input input-xs w-20"
                        disabled={savingField?.productId === p.id && savingField?.fieldName === 'stock'}
                      />
                      <div className='flex flex-col join join-horizontal border border-base-content/10'>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'stock')}>
                          <CheckIcon className="h-[1em]" />
                        </button>
                        <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'stock')}>
                          <XMarkIcon className="h-[1em]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-row btn-group gap-1 items-center">
                        <button
                          className="btn btn-ghost btn-xs"
                          aria-label="decrement stock"
                          disabled={savingField?.productId === p.id && savingField?.fieldName === 'stock'}
                          onClick={() => changeStockBy(p.id, -1)}
                        >
                          ▼
                        </button>
                        <span className="cursor-pointer hover:bg-base-200 rounded px-1" onClick={() => startEditStock(p.id, p.stock)} title="Click para editar">
                          {p.stock}
                        </span>
                        <button
                          className="btn btn-ghost btn-xs"
                          aria-label="increment stock"
                          disabled={savingField?.productId === p.id && savingField?.fieldName === 'stock'}
                          onClick={() => changeStockBy(p.id, 1)}
                        >
                          ▲
                        </button>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <div className="dropdown dropdown-start relative">
                    <div tabIndex={0} role="button" className="flex flex-row flex-nowrap gap-2 items-center cursor-pointer btn btn-xs btn-ghost py-2">
                      <span className={`badge badge-sm ${stateColorMap[p.state] ?? 'badge-ghost'}`}>{p.state}</span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </div>
                    <ul tabIndex={-1} className="fixed dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 !z-[1000]">
                      {stateOptions.map((s) => (
                        <li key={s} className='py-2 flex flex-row items-center gap-2'>
                          <button
                            className={`w-full text-left btn btn-ghost btn-xs justify-start ${stateColorMap[s] ?? ''}`}
                            disabled={savingStateId === p.id}
                            onClick={() => changeState(p.id, s)}
                          >
                            {s}
                            <div className={`w-2 h-2 rounded-full border ${stateColorMap[s] ?? ''}`}></div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </td>
                <td className="flex items-center gap-2">
                  <Link href={`/products/${p.id}/edit`} className="btn btn-xs btn-square btn-soft">
                    <PencilIcon className="size-[1.2em]" />
                  </Link>
                  <button
                    className="btn btn-xs btn-square btn-soft btn-error"
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
                        <TrashIcon className="size-[1.2em]" />
                      </>
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}