"use client"

import { useEffect, useMemo, useState } from "react"
import CatalogAutocomplete, { type CatalogAutocompleteOption } from "@/components/products/CatalogAutocomplete"

type ProductType = "PHONE" | "ACCESSORY"
type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"
type CatalogSource = "BASE" | "CUSTOM" | "LEGACY"

export type CatalogModelDto = {
  id: string
  type: ProductType
  name: string
  normalizedName?: string | null
  source: CatalogSource
  isActive: boolean
}

export type CatalogCapacityDto = {
  id: string
  capacityGB: number
  label: string
  source: CatalogSource
  isActive: boolean
}

export type CatalogColorDto = {
  id: string
  name: string
  hexColor: string
  source: CatalogSource
  isActive: boolean
}

type ProductCatalogSelectorsProps = {
  type: ProductType
  activeRole?: Role | null
  disabled?: boolean
  modelId: string | null
  modelName: string
  capacityId: string | null
  capacityGB: string
  colorId: string | null
  color: string
  initialModel?: CatalogModelDto | null
  initialCapacity?: CatalogCapacityDto | null
  initialColor?: CatalogColorDto | null
  onChange: (patch: Partial<{
    catalogModelId: string
    modelName: string
    catalogCapacityId: string
    capacityGB: string
    catalogColorId: string
    color: string
  }>) => void
}

type QuickCreateState =
  | { kind: "models"; initialText: string }
  | { kind: "capacities"; initialText: string }
  | { kind: "colors"; initialText: string }
  | null

function toModelOption(model: CatalogModelDto): CatalogAutocompleteOption<CatalogModelDto> {
  return {
    id: model.id,
    label: model.name,
    description: model.type === "PHONE" ? "Telefono" : "Accesorio",
    metadata: model.source,
    source: model.source,
    isActive: model.isActive,
    item: model,
  }
}

function toCapacityOption(capacity: CatalogCapacityDto): CatalogAutocompleteOption<CatalogCapacityDto> {
  return {
    id: capacity.id,
    label: capacity.label,
    description: `${capacity.capacityGB} GB`,
    metadata: capacity.source,
    source: capacity.source,
    isActive: capacity.isActive,
    item: capacity,
  }
}

function toColorOption(color: CatalogColorDto): CatalogAutocompleteOption<CatalogColorDto> {
  return {
    id: color.id,
    label: color.name,
    description: color.hexColor,
    metadata: color.source,
    source: color.source,
    isActive: color.isActive,
    swatchColor: color.hexColor,
    item: color,
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function parseCapacityFromText(value: string) {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(tb|gb)?/i)
  if (!match) return ""
  const amount = Number(match[1].replace(",", "."))
  if (!Number.isFinite(amount) || amount <= 0) return ""
  const unit = match[2]?.toLowerCase()
  return String(unit === "tb" ? Math.round(amount * 1024) : Math.round(amount))
}

function deriveCapacityLabel(capacityGB: string) {
  const value = Number(capacityGB)
  if (!Number.isInteger(value) || value <= 0) return ""
  if (value >= 1024 && value % 1024 === 0) return `${value / 1024} TB`
  return `${value} GB`
}

function QuickCreateDialog({
  state,
  productType,
  onClose,
  onCreated,
}: {
  state: QuickCreateState
  productType: ProductType
  onClose: () => void
  onCreated: (kind: NonNullable<QuickCreateState>["kind"], item: CatalogModelDto | CatalogCapacityDto | CatalogColorDto) => void
}) {
  const [name, setName] = useState(state?.initialText ?? "")
  const [capacityGB, setCapacityGB] = useState(state?.kind === "capacities" ? parseCapacityFromText(state.initialText) : "")
  const [capacityLabel, setCapacityLabel] = useState("")
  const [hexColor, setHexColor] = useState("#000000")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(state?.initialText ?? "")
    setCapacityGB(state?.kind === "capacities" ? parseCapacityFromText(state.initialText) : "")
    setCapacityLabel("")
    setHexColor("#000000")
    setError(null)
  }, [state])

  if (!state) return null

  async function submit() {
    if (!state) return
    setSaving(true)
    setError(null)

    const payload =
      state.kind === "models"
        ? { type: productType, name }
        : state.kind === "capacities"
          ? { capacityGB: Number(capacityGB), label: capacityLabel || undefined }
          : { name, hexColor }

    try {
      const response = await fetch(`/api/catalogs/${state.kind}/quick-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "No se pudo crear la opcion.")
      onCreated(state.kind, body.item)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la opcion.")
    } finally {
      setSaving(false)
    }
  }

  const title =
    state.kind === "models"
      ? "Agregar modelo"
      : state.kind === "capacities"
        ? "Agregar capacidad"
        : "Agregar color"

  return (
    <dialog className="modal modal-open">
      <div className="modal-box rounded-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        {error ? <div className="alert alert-error mt-3 py-2 text-sm">{error}</div> : null}
        <div className="mt-4 grid gap-3">
          {state.kind === "models" ? (
            <label className="form-control">
              <span className="label-text">Nombre *</span>
              <input className="input input-bordered" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} autoFocus />
            </label>
          ) : null}
          {state.kind === "capacities" ? (
            <>
              <label className="form-control">
                <span className="label-text">Capacidad numerica *</span>
                <input className="input input-bordered" type="number" min={1} max={8192} value={capacityGB} onChange={(event) => setCapacityGB(event.target.value)} disabled={saving} autoFocus />
              </label>
              <label className="form-control">
                <span className="label-text">Label opcional</span>
                <input className="input input-bordered" value={capacityLabel} placeholder={deriveCapacityLabel(capacityGB)} onChange={(event) => setCapacityLabel(event.target.value)} disabled={saving} />
              </label>
            </>
          ) : null}
          {state.kind === "colors" ? (
            <>
              <label className="form-control">
                <span className="label-text">Nombre *</span>
                <input className="input input-bordered" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} autoFocus />
              </label>
              <label className="form-control">
                <span className="label-text">Color hexadecimal *</span>
                <div className="flex gap-2">
                  <input className="h-12 w-16 rounded border border-base-300 bg-base-100" type="color" value={hexColor} onChange={(event) => setHexColor(event.target.value)} disabled={saving} />
                  <input className="input input-bordered flex-1" value={hexColor} onChange={(event) => setHexColor(event.target.value)} disabled={saving} />
                </div>
              </label>
            </>
          ) : null}
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Cerrar" onClick={onClose}>cerrar</button>
    </dialog>
  )
}

export default function ProductCatalogSelectors({
  type,
  activeRole,
  disabled = false,
  modelId,
  modelName,
  capacityId,
  capacityGB,
  colorId,
  color,
  initialModel,
  initialCapacity,
  initialColor,
  onChange,
}: ProductCatalogSelectorsProps) {
  const allowCreate = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const [modelQuery, setModelQuery] = useState("")
  const [capacityQuery, setCapacityQuery] = useState("")
  const [colorQuery, setColorQuery] = useState("")
  const [models, setModels] = useState<CatalogModelDto[]>([])
  const [capacities, setCapacities] = useState<CatalogCapacityDto[]>([])
  const [colors, setColors] = useState<CatalogColorDto[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading((current) => ({ ...current, models: true }))
      try {
        const params = new URLSearchParams({ type, active: "true", limit: "20" })
        if (modelQuery.trim()) params.set("q", modelQuery.trim())
        const response = await fetch(`/api/catalogs/models?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No se pudieron cargar modelos.")
        setModels(Array.isArray(body.items) ? body.items : [])
        setFieldErrors((current) => ({ ...current, models: null }))
      } catch (error: any) {
        if (error?.name !== "AbortError") setFieldErrors((current) => ({ ...current, models: error?.message ?? "Error de red." }))
      } finally {
        if (!controller.signal.aborted) setLoading((current) => ({ ...current, models: false }))
      }
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [modelQuery, type])

  useEffect(() => {
    if (type !== "PHONE") {
      setCapacities([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading((current) => ({ ...current, capacities: true }))
      try {
        const params = new URLSearchParams({ active: "true", limit: "20" })
        if (capacityQuery.trim()) params.set("q", capacityQuery.trim())
        const response = await fetch(`/api/catalogs/capacities?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No se pudieron cargar capacidades.")
        setCapacities(Array.isArray(body.items) ? body.items : [])
        setFieldErrors((current) => ({ ...current, capacities: null }))
      } catch (error: any) {
        if (error?.name !== "AbortError") setFieldErrors((current) => ({ ...current, capacities: error?.message ?? "Error de red." }))
      } finally {
        if (!controller.signal.aborted) setLoading((current) => ({ ...current, capacities: false }))
      }
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [capacityQuery, type])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading((current) => ({ ...current, colors: true }))
      try {
        const params = new URLSearchParams({ active: "true", limit: "20" })
        if (colorQuery.trim()) params.set("q", colorQuery.trim())
        const response = await fetch(`/api/catalogs/colors?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No se pudieron cargar colores.")
        setColors(Array.isArray(body.items) ? body.items : [])
        setFieldErrors((current) => ({ ...current, colors: null }))
      } catch (error: any) {
        if (error?.name !== "AbortError") setFieldErrors((current) => ({ ...current, colors: error?.message ?? "Error de red." }))
      } finally {
        if (!controller.signal.aborted) setLoading((current) => ({ ...current, colors: false }))
      }
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [colorQuery])

  useEffect(() => {
    if (type === "ACCESSORY" && (capacityId || capacityGB)) {
      onChange({ catalogCapacityId: "", capacityGB: "" })
    }
  }, [capacityGB, capacityId, onChange, type])

  const modelOptions = useMemo(() => uniqueById([...(initialModel ? [initialModel] : []), ...models]).filter((model) => model.type === type || model.id === modelId).map(toModelOption), [initialModel, modelId, models, type])
  const capacityOptions = useMemo(() => uniqueById([...(initialCapacity ? [initialCapacity] : []), ...capacities]).map(toCapacityOption), [capacities, initialCapacity])
  const colorOptions = useMemo(() => uniqueById([...(initialColor ? [initialColor] : []), ...colors]).map(toColorOption), [colors, initialColor])

  const selectedModel = modelId
    ? modelOptions.find((option) => option.id === modelId) ?? { id: modelId, label: modelName || "Modelo seleccionado" }
    : null
  const selectedCapacity = capacityId
    ? capacityOptions.find((option) => option.id === capacityId) ?? { id: capacityId, label: capacityGB ? `${capacityGB} GB` : "Capacidad seleccionada" }
    : null
  const selectedColor = colorId
    ? colorOptions.find((option) => option.id === colorId) ?? { id: colorId, label: color || "Color seleccionado" }
    : null

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  function handleCreated(kind: NonNullable<QuickCreateState>["kind"], item: CatalogModelDto | CatalogCapacityDto | CatalogColorDto) {
    if (kind === "models") {
      const model = item as CatalogModelDto
      setModels((current) => uniqueById([model, ...current]))
      onChange({ catalogModelId: model.id, modelName: model.name })
      showToast("Modelo agregado")
    } else if (kind === "capacities") {
      const capacity = item as CatalogCapacityDto
      setCapacities((current) => uniqueById([capacity, ...current]))
      onChange({ catalogCapacityId: capacity.id, capacityGB: String(capacity.capacityGB) })
      showToast("Capacidad agregada")
    } else {
      const createdColor = item as CatalogColorDto
      setColors((current) => uniqueById([createdColor, ...current]))
      onChange({ catalogColorId: createdColor.id, color: createdColor.name })
      showToast("Color agregado")
    }
    setQuickCreate(null)
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="toast toast-top toast-end z-[120]">
          <div className="alert alert-success text-sm shadow-lg"><span>{toast}</span></div>
        </div>
      ) : null}
      {modelName && !modelId ? (
        <div className="alert alert-warning py-2 text-sm">
          Este producto utiliza un valor historico. Selecciona una opcion del catalogo para normalizarlo.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <CatalogAutocomplete<CatalogModelDto>
          label="Modelo"
          placeholder={type === "PHONE" ? "Buscar iPhone..." : "Buscar accesorio..."}
          required
          disabled={disabled}
          value={selectedModel}
          options={modelOptions}
          loading={loading.models}
          error={fieldErrors.models}
          allowCreate={allowCreate}
          onSearchChange={setModelQuery}
          onChange={(option) => {
            const model = option?.item
            onChange({
              catalogModelId: model?.id ?? "",
              modelName: model?.name ?? "",
              ...(type === "ACCESSORY" ? { catalogCapacityId: "", capacityGB: "" } : {}),
            })
          }}
          onCreate={(query) => setQuickCreate({ kind: "models", initialText: query })}
        />
        <CatalogAutocomplete<CatalogColorDto>
          label="Color"
          placeholder="Buscar color..."
          disabled={disabled}
          value={selectedColor}
          options={colorOptions}
          loading={loading.colors}
          error={fieldErrors.colors}
          allowCreate={allowCreate}
          onSearchChange={setColorQuery}
          onChange={(option) => {
            const selected = option?.item
            onChange({ catalogColorId: selected?.id ?? "", color: selected?.name ?? "" })
          }}
          onCreate={(query) => setQuickCreate({ kind: "colors", initialText: query })}
        />
        {type === "PHONE" ? (
          <CatalogAutocomplete<CatalogCapacityDto>
            label="Capacidad"
            placeholder="Buscar capacidad..."
            disabled={disabled}
            value={selectedCapacity}
            options={capacityOptions}
            loading={loading.capacities}
            error={fieldErrors.capacities}
            allowCreate={allowCreate}
            onSearchChange={setCapacityQuery}
            onChange={(option) => {
              const selected = option?.item
              onChange({ catalogCapacityId: selected?.id ?? "", capacityGB: selected?.capacityGB == null ? "" : String(selected.capacityGB) })
            }}
            onCreate={(query) => setQuickCreate({ kind: "capacities", initialText: query })}
          />
        ) : null}
      </div>
      <QuickCreateDialog state={quickCreate} productType={type} onClose={() => setQuickCreate(null)} onCreated={handleCreated} />
    </div>
  )
}
