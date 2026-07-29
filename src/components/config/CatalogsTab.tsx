"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CloudArrowDownIcon,
  CubeIcon,
  DevicePhoneMobileIcon,
  RectangleStackIcon,
  SparklesIcon,
  SwatchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import type { CatalogModel, CatalogPayload } from "@/components/config/types"

type CardKey = "devices" | "accessories" | "capacities" | "measures" | "colors"

const cards: {
  key: CardKey
  label: string
  category: "models" | "capacities" | "measures" | "colors"
  type?: "PHONE" | "ACCESSORY"
  icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { key: "devices", label: "Equipos / Dispositivos", category: "models", type: "PHONE", icon: DevicePhoneMobileIcon },
  { key: "accessories", label: "Accesorios", category: "models", type: "ACCESSORY", icon: CubeIcon },
  { key: "capacities", label: "Capacidad", category: "capacities", icon: RectangleStackIcon },
  { key: "measures", label: "Medidas", category: "measures", icon: RectangleStackIcon },
  { key: "colors", label: "Colores", category: "colors", icon: SwatchIcon },
]

export default function CatalogsTab() {
  const [data, setData] = useState<CatalogPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<CardKey>>(new Set())
  const [baseLoadKey, setBaseLoadKey] = useState<CardKey | null>(null)
  const [baseLoadRunning, setBaseLoadRunning] = useState(false)
  const [dedupeRunningKey, setDedupeRunningKey] = useState<CardKey | null>(null)
  const [refreshingCardKey, setRefreshingCardKey] = useState<CardKey | null>(null)
  const [compatModel, setCompatModel] = useState<CatalogModel | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(options: { cardKey?: CardKey; global?: boolean } = {}) {
    const useGlobalLoading = options.global ?? !data
    if (useGlobalLoading) setLoading(true)
    else if (options.cardKey) setRefreshingCardKey(options.cardKey)

    const response = await fetch("/api/config/catalogs", { cache: "no-store" })
    const body = await response.json().catch(() => null)
    if (!response.ok) setError(body?.error ?? "No se pudieron cargar catalogos")
    else {
      setData(body)
      setError(null)
    }
    if (useGlobalLoading) setLoading(false)
    if (options.cardKey) setRefreshingCardKey(null)
  }

  useEffect(() => {
    void load({ global: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  async function runBaseLoad(key: CardKey) {
    setBaseLoadRunning(true)
    setError(null)
    const response = await fetch("/api/config/catalogs/base-load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: key }),
    })
    const body = await response.json().catch(() => null)
    setBaseLoadRunning(false)
    if (!response.ok) {
      setError(body?.error ?? "No se pudo ejecutar carga base")
      return
    }
    setBaseLoadKey(null)
    await load({ cardKey: key, global: false })
    showToast(`Carga base: ${body.created} creados, ${body.existing} existentes`)
  }

  async function runDedupe(card: (typeof cards)[number]) {
    setDedupeRunningKey(card.key)
    setError(null)
    const response = await fetch("/api/config/catalogs/dedupe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: card.category, type: card.type }),
    })
    const body = await response.json().catch(() => null)
    setDedupeRunningKey(null)
    if (!response.ok) {
      setError(body?.error ?? "No se pudieron limpiar duplicados")
      return
    }
    await load({ cardKey: card.key, global: false })
    showToast(`${body.removed ?? 0} duplicados eliminados en ${card.label}`)
  }

  function toggleExpanded(key: CardKey) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) return <div className="rounded-lg border border-base-300 p-6"><span className="loading loading-spinner" /></div>
  if (!data) return <div className="alert alert-error">{error ?? "Catalogos no disponibles"}</div>

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="toast toast-top toast-end z-[120]">
          <div className="alert alert-success text-sm shadow-lg"><span>{toast}</span></div>
        </div>
      ) : null}
      {error ? <div className="alert alert-error py-3 text-sm">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          const isOpen = expanded.has(card.key)
          const dedupeLoading = dedupeRunningKey === card.key
          const cardRefreshing = refreshingCardKey === card.key
          return (
            <section key={card.key} className="rounded-lg border border-base-300 bg-base-100 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{card.label}</h2>
                  <p className="text-sm text-base-content/60">
                    {data.counts[card.key]} activos
                    {cardRefreshing ? <span className="loading loading-spinner loading-xs ml-2 align-middle" /> : null}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setBaseLoadKey(card.key)}>
                  <CloudArrowDownIcon className="size-4" />
                  Carga base
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-square"
                  onClick={() => void runDedupe(card)}
                  disabled={dedupeLoading}
                  title="Eliminar duplicados"
                  aria-label={`Eliminar duplicados de ${card.label}`}
                >
                  {dedupeLoading ? <span className="loading loading-spinner loading-xs" /> : <SparklesIcon className="size-4" />}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => toggleExpanded(card.key)}>
                  <ChevronDownIcon className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  Gestionar
                </button>
              </div>
              {isOpen ? (
                <CatalogExpanded
                  card={card}
                  data={data}
                  onChanged={async (message) => {
                    await load({ cardKey: card.key, global: false })
                    showToast(message)
                  }}
                  onError={setError}
                  onCompat={setCompatModel}
                />
              ) : null}
            </section>
          )
        })}
      </div>

      {baseLoadKey ? (
        <dialog className="modal modal-open">
          <div className="modal-box rounded-lg">
            <h3 className="text-lg font-semibold">Carga base</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Se intentaran cargar {data.baseCounts[baseLoadKey]} registros base para {cards.find((card) => card.key === baseLoadKey)?.label}.
            </p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setBaseLoadKey(null)} disabled={baseLoadRunning}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => void runBaseLoad(baseLoadKey)} disabled={baseLoadRunning}>
                {baseLoadRunning ? <span className="loading loading-spinner loading-xs" /> : null}
                Ejecutar
              </button>
            </div>
          </div>
        </dialog>
      ) : null}

      {compatModel ? (
        <CompatibilityModal
          phoneModel={compatModel}
          data={data}
          onClose={() => setCompatModel(null)}
          onSaved={async () => {
            setCompatModel(null)
            await load({ cardKey: "devices", global: false })
            showToast("Compatibilidades guardadas")
          }}
          onError={setError}
        />
      ) : null}
    </div>
  )
}

function CatalogExpanded({
  card,
  data,
  onChanged,
  onError,
  onCompat,
}: {
  card: (typeof cards)[number]
  data: CatalogPayload
  onChanged: (message: string) => void | Promise<void>
  onError: (message: string | null) => void
  onCompat: (model: CatalogModel) => void
}) {
  const [name, setName] = useState("")
  const [hexColor, setHexColor] = useState("#000000")
  const [capacityGB, setCapacityGB] = useState("")
  const [measureMm, setMeasureMm] = useState("")
  const [saving, setSaving] = useState(false)

  const items = useMemo(() => {
    if (card.category === "models") return data.models.filter((item) => item.type === card.type)
    if (card.category === "capacities") return data.capacities
    if (card.category === "measures") return data.measures
    return data.colors
  }, [card, data])

  async function createItem() {
    setSaving(true)
    onError(null)
    const body =
      card.category === "models"
        ? { category: "models", type: card.type, name }
        : card.category === "capacities"
          ? { category: "capacities", capacityGB: Number(capacityGB), label: name || `${capacityGB} GB` }
          : card.category === "measures"
            ? { category: "measures", millimeters: Number(measureMm), label: name || `${measureMm} mm` }
            : { category: "colors", name, hexColor }

    const response = await fetch("/api/config/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      onError(payload?.error ?? "No se pudo crear item")
      return
    }
    setName("")
    setCapacityGB("")
    setMeasureMm("")
    await onChanged("Catalogo actualizado")
  }

  async function deactivate(id: string) {
    const response = await fetch(`/api/config/catalogs/${id}?category=${card.category}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      onError(payload?.error ?? "No se pudo desactivar item")
      return
    }
    await onChanged("Item desactivado")
  }

  return (
    <div className="mt-4 border-t border-base-300 pt-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-2 sm:grid-cols-2">
          {card.category === "capacities" ? (
            <input className="input input-bordered input-sm" type="number" min={0} placeholder="GB" value={capacityGB} onChange={(event) => setCapacityGB(event.target.value)} />
          ) : null}
          {card.category === "measures" ? (
            <input className="input input-bordered input-sm" type="number" min={0} step="0.01" placeholder="Milimetros" value={measureMm} onChange={(event) => setMeasureMm(event.target.value)} />
          ) : null}
          <input className="input input-bordered input-sm" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
          {card.category === "colors" ? (
            <div className="flex gap-2">
              <input className="h-8 w-12 rounded border border-base-300 bg-base-100" type="color" value={hexColor} onChange={(event) => setHexColor(event.target.value)} />
              <input className="input input-bordered input-sm" value={hexColor} onChange={(event) => setHexColor(event.target.value)} />
            </div>
          ) : null}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={createItem} disabled={saving || (!name && card.category !== "capacities" && card.category !== "measures")}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : null}
          Agregar
        </button>
      </div>

      <div className="mt-4 flex max-h-96 flex-wrap gap-2 overflow-y-auto">
        {items.map((item: any) => {
          const active = item.isActive
          const isPhoneModel = card.category === "models" && item.type === "PHONE"
          const isAccessoryModel = card.category === "models" && item.type === "ACCESSORY"
          return (
            <div key={item.id} className={`flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm ${active ? "border-base-300" : "border-base-300 bg-base-200 opacity-60"}`}>
              {card.category === "colors" ? <span className="size-4 rounded-full border border-base-300" style={{ backgroundColor: item.hexColor }} /> : null}
              <span className="min-w-0 truncate">
                {card.category === "capacities" ? item.label : card.category === "measures" ? `${item.label} (${item.millimeters} mm)` : item.name}
              </span>
              <span className="badge badge-ghost badge-xs">{item.source}</span>
              {isPhoneModel ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => onCompat(item)}>Compatibles</button>
              ) : null}
              {isAccessoryModel ? (
                <span className="badge badge-outline badge-xs text-nowrap">Compatible con {item._count?.phoneCompatibilities ?? 0}</span>
              ) : null}
              {card.category === "colors" && item.aliases?.length ? (
                <span className="tooltip" data-tip={item.aliases.map((alias: any) => alias.alias).join(", ")}>
                  <span className="badge badge-outline badge-xs">{item.aliases.length} aliases</span>
                </span>
              ) : null}
              {active ? (
                <button type="button" className="btn btn-ghost btn-xs btn-square text-error" onClick={() => void deactivate(item.id)} aria-label="Desactivar">
                  <XMarkIcon className="size-4" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompatibilityModal({
  phoneModel,
  data,
  onClose,
  onSaved,
  onError,
}: {
  phoneModel: CatalogModel
  data: CatalogPayload
  onClose: () => void
  onSaved: () => void | Promise<void>
  onError: (message: string | null) => void
}) {
  const accessories = data.models.filter((model) => model.type === "ACCESSORY" && model.isActive)
  const current = new Set(
    data.compatibilities
      .filter((compatibility) => compatibility.phoneModelId === phoneModel.id && compatibility.isActive)
      .map((compatibility) => compatibility.accessoryModelId),
  )
  const [selected, setSelected] = useState<Set<string>>(current)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const filtered = accessories.filter((accessory) => accessory.name.toLowerCase().includes(query.trim().toLowerCase()))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    const response = await fetch("/api/config/catalogs/compatibilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneModelId: phoneModel.id, accessoryModelIds: Array.from(selected) }),
    })
    const body = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      onError(body?.error ?? "No se pudieron guardar compatibilidades")
      return
    }
    await onSaved()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <h3 className="text-lg font-semibold">{phoneModel.name}</h3>
        <div className="mt-4">
          <input className="input input-bordered w-full" placeholder="Buscar accesorio" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {filtered.map((accessory) => {
            const checked = selected.has(accessory.id)
            return (
              <label key={accessory.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${checked ? "border-primary bg-primary/10" : "border-base-300"}`}>
                <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" checked={checked} onChange={() => toggle(accessory.id)} />
                <span className="flex-1">{accessory.name}</span>
                <span className="badge badge-ghost badge-sm">Stock cat.: {accessory._count?.products ?? 0}</span>
              </label>
            )
          })}
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <CheckIcon className="size-4" />}
            Guardar
          </button>
        </div>
      </div>
    </dialog>
  )
}
