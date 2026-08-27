"use client"

import type { Buyer } from "@prisma/client"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import BuyerSection from "@/components/sales/BuyerSection"
import PaymentsSection from "@/components/sales/PaymentsSection"
import { formatUsd } from "@/components/sales/salesUtils"
import type { PaymentDraft } from "@/components/sales/types"
import { IPHONE_TRADE_IN_CATALOG } from "@/lib/trade-in/iphoneCatalog"

export type CustomerOrderProductOption = { id: string; label: string; salePrice: string; stockAvailable: number }
export type CustomerOrderCreateSuccess = { id: string }

type CustomerOrderSource = "INTERNAL" | "INSTAGRAM" | "OFFICE" | "ECOMMERCE" | "WHATSAPP" | "OTHER"
type DeviceLine = {
  id: string
  modelName: string
  capacityGB: string
  color: string
  unitPriceUsd: string
}
type AccessoryLine = { productId: string; quantity: number; unitPriceUsd: string }

const sources: Array<{ value: CustomerOrderSource; label: string }> = [
  { value: "INTERNAL", label: "Interno" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "OFFICE", label: "Oficina" },
  { value: "ECOMMERCE", label: "Ecommerce" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Otro" },
]

function makeClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toNumber(value?: string | number | null) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function isCommonAccessory(label: string) {
  return /\b(cable|cables|fuente|fuentes|cargador|cargadores|usb|lightning|type c|tipo c|magsafe)\b/i.test(label)
}

function normalizeSuggestionText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function modelTokens(modelName: string) {
  const normalized = normalizeSuggestionText(modelName).replace(/^iphone\s+/, "")
  const compact = normalized.replace(/\s+/g, " ").trim()
  return Array.from(new Set([compact, compact.replace(/\s+/g, " "), compact.replace(/\s+pro max$/, " pro max")].filter((item) => item.length >= 2)))
}

export default function CustomerOrderCreateForm({
  products,
  branchId,
  defaultDeliveryDays,
  formId,
  hideActions = false,
  onSuccess,
  onCancel,
  onSubmittingChange,
}: {
  products: CustomerOrderProductOption[]
  branchId: string
  defaultDeliveryDays: number
  formId?: string
  hideActions?: boolean
  onSuccess?: (payload: CustomerOrderCreateSuccess) => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const router = useRouter()
  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [source, setSource] = useState<CustomerOrderSource>("INTERNAL")
  const [devices, setDevices] = useState<DeviceLine[]>([])
  const [accessories, setAccessories] = useState<AccessoryLine[]>([])
  const [payments, setPayments] = useState<PaymentDraft[]>([])
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const date = new Date(Date.now() + defaultDeliveryDays * 86400000)
    return date.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => {
    const deviceTotal = devices.reduce((sum, line) => sum + toNumber(line.unitPriceUsd), 0)
    const accessoryTotal = accessories.reduce((sum, line) => sum + toNumber(line.unitPriceUsd) * line.quantity, 0)
    return deviceTotal + accessoryTotal
  }, [accessories, devices])

  const paidUsd = useMemo(
    () => payments.reduce((sum, payment) => sum + toNumber(payment.coveredBaseUsd ?? payment.amountUsd ?? ((payment.currency === "USD" || payment.currency === "USDT") ? payment.amount : "0")), 0),
    [payments],
  )
  const remaining = Math.max(total - paidUsd, 0)

  useEffect(() => {
    onSubmittingChange?.(submitting)
  }, [submitting, onSubmittingChange])

  function addAccessory(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || devices.length === 0) return
    setAccessories((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) => item.productId === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stockAvailable) } : item)
      }
      return [...current, { productId: product.id, quantity: 1, unitPriceUsd: product.salePrice }]
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const invalidDevice = devices.find((device) => !device.modelName || !device.capacityGB || !device.color.trim() || toNumber(device.unitPriceUsd) <= 0)
    const invalidPayment = payments.find((payment) => toNumber(payment.amount) <= 0 || (payment.method !== "PLAN_CANJE" && !payment.cashAccountId))
    if (!buyer?.id || devices.length === 0 || invalidDevice || payments.length === 0 || invalidPayment || paidUsd <= 0) {
      setError("Completa cliente, al menos un celular, seña y caja del pago.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyerId: buyer.id,
          branchId,
          source,
          estimatedDeliveryAt: deliveryDate ? `${deliveryDate}T12:00:00` : null,
          notes: notes.trim() || null,
          items: [
            ...devices.map((device) => ({
              kind: "ON_DEMAND",
              description: `${device.modelName} ${device.capacityGB}GB ${device.color}`.trim(),
              modelName: device.modelName,
              capacityGB: Number(device.capacityGB),
              color: device.color.trim(),
              quantity: 1,
              unitPriceUsd: device.unitPriceUsd,
            })),
            ...accessories.map((line) => {
              const product = products.find((item) => item.id === line.productId)
              return {
                kind: "STOCK",
                stockProductId: line.productId,
                description: product?.label ?? "Accesorio",
                quantity: line.quantity,
                unitPriceUsd: line.unitPriceUsd,
              }
            }),
          ],
          payments: payments.map((payment) => ({
            method: payment.method,
            currency: payment.currency,
            amount: payment.amount,
            exchangeRate: payment.exchangeRate ?? null,
            cashAccountId: payment.cashAccountId ?? null,
            installments: payment.method === "BNA_CUOTAS" ? payment.installments ?? null : null,
            note: payment.note ?? null,
          })),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo crear el pedido.")
      if (onSuccess) {
        onSuccess(payload)
      } else {
        router.push(`/dashboard/orders/${payload.id}`)
        router.refresh()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el pedido.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="flex max-w-5xl flex-col gap-6">
      {error ? <div className="alert alert-error"><span>{error}</span></div> : null}

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <h2 className="text-lg font-semibold">Cliente y origen</h2>
          <label className="form-control w-full md:w-56">
            <span className="label-text mb-1">Origen</span>
            <select className="select select-bordered" value={source} onChange={(event) => setSource(event.target.value as CustomerOrderSource)} disabled={submitting}>
              {sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <BuyerSection selectedBuyer={buyer} setSelectedBuyer={setBuyer} disabled={submitting} />
        {buyer && (!buyer.surname || !buyer.dni || !buyer.phone || !buyer.email) ? (
          <div className="mt-3 text-sm text-warning">Este cliente no tiene apellido, DNI, teléfono y email completos. Actualizalo antes de confirmar el pedido.</div>
        ) : null}
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Producto bajo demanda</h2>
          <span className="badge badge-outline">{devices.length} celular{devices.length === 1 ? "" : "es"}</span>
        </div>
        <CustomerOrderDevicesSection devices={devices} setDevices={setDevices} disabled={submitting} />
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Accesorios reservados ahora</h2>
          <span className="text-sm text-base-content/60">Disponible después de agregar celulares</span>
        </div>
        <CustomerOrderAccessoriesSection
          products={products}
          devices={devices}
          accessories={accessories}
          setAccessories={setAccessories}
          onAddAccessory={addAccessory}
          disabled={submitting}
        />
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Seña / pago inicial</h2>
          <div className="text-sm">
            Pedido <strong>{formatUsd(total)}</strong>
            <span className="mx-2 text-base-content/40">·</span>
            Restante <strong className={remaining > 0.009 ? "text-warning" : "text-success"}>{formatUsd(remaining)}</strong>
          </div>
        </div>
        <PaymentsSection payments={payments} setPayments={setPayments} total={total.toFixed(2)} disabled={submitting || total <= 0} />
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1">Entrega estimada</span>
            <input className="input input-bordered" type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} disabled={submitting} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Notas</span>
            <textarea className="textarea textarea-bordered" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} />
          </label>
        </div>
      </section>

      {!hideActions ? (
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
          ) : null}
          <button className="btn btn-primary" disabled={submitting}>{submitting ? "Creando..." : "Confirmar pedido"}</button>
        </div>
      ) : null}
    </form>
  )
}

function CustomerOrderDevicesSection({
  devices,
  setDevices,
  disabled,
}: {
  devices: DeviceLine[]
  setDevices: (devices: DeviceLine[]) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState<DeviceLine>({ id: "", modelName: "", capacityGB: "", color: "", unitPriceUsd: "" })
  const selectedCatalogModel = IPHONE_TRADE_IN_CATALOG.flatMap((series) => series.models).find((model) => model.modelName === draft.modelName)

  function resetDraft() {
    setDraft({ id: "", modelName: "", capacityGB: "", color: "", unitPriceUsd: "" })
  }

  function addDevice() {
    if (!draft.modelName || !draft.capacityGB || !draft.color.trim() || toNumber(draft.unitPriceUsd) <= 0) return
    setDevices([...devices, { ...draft, id: makeClientId("order-device"), color: draft.color.trim() }])
    resetDraft()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 font-semibold">Datos del equipo</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_auto]">
          <label className="form-control">
            <span className="label-text">Modelo</span>
            <select
              className="select select-bordered"
              value={draft.modelName}
              onChange={(event) => setDraft({ ...draft, modelName: event.target.value, capacityGB: "" })}
              disabled={disabled}
            >
              <option value="">Seleccionar</option>
              {IPHONE_TRADE_IN_CATALOG.map((series) => (
                <optgroup key={series.series} label={series.series}>
                  {series.models.map((model) => <option key={model.modelName} value={model.modelName}>{model.modelName}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Capacidad</span>
            <select className="select select-bordered" value={draft.capacityGB} onChange={(event) => setDraft({ ...draft, capacityGB: event.target.value })} disabled={disabled || !selectedCatalogModel}>
              <option value="">Seleccionar</option>
              {selectedCatalogModel?.capacities.map((capacity) => <option key={capacity} value={capacity}>{capacity} GB</option>)}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Color</span>
            <input className="input input-bordered" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} placeholder="Natural Titanium" disabled={disabled} />
          </label>
          <label className="form-control">
            <span className="label-text">Precio USD</span>
            <input className="input input-bordered" inputMode="decimal" value={draft.unitPriceUsd} onChange={(event) => setDraft({ ...draft, unitPriceUsd: event.target.value })} disabled={disabled} />
          </label>
          <div className="flex items-end">
            <button type="button" className="btn btn-primary w-full" onClick={addDevice} disabled={disabled || !draft.modelName || !draft.capacityGB || !draft.color.trim() || toNumber(draft.unitPriceUsd) <= 0}>
              Agregar
            </button>
          </div>
        </div>
      </div>

      {devices.length ? (
        <div className="grid gap-2">
          {devices.map((device) => (
            <div key={device.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-base-200 p-3">
              <span className="min-w-56 flex-1 font-medium">{device.modelName} {device.capacityGB}GB · {device.color}</span>
              <span className="font-mono text-sm">{formatUsd(device.unitPriceUsd)}</span>
              <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setDevices(devices.filter((item) => item.id !== device.id))} disabled={disabled}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-base-300 p-4 text-sm text-base-content/60">Agrega uno o más celulares para habilitar accesorios y pagos.</div>
      )}
    </div>
  )
}

function CustomerOrderAccessoriesSection({
  products,
  devices,
  accessories,
  setAccessories,
  onAddAccessory,
  disabled,
}: {
  products: CustomerOrderProductOption[]
  devices: DeviceLine[]
  accessories: AccessoryLine[]
  setAccessories: (accessories: AccessoryLine[]) => void
  onAddAccessory: (productId: string) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState("")
  const enabled = devices.length > 0 && !disabled
  const selectedIds = new Set(accessories.map((item) => item.productId))
  const commonSuggestions = products.filter((product) => isCommonAccessory(product.label)).slice(0, 8)
  const modelSuggestions = products.filter((product) => {
    const label = normalizeSuggestionText(product.label)
    return devices.some((device) => modelTokens(device.modelName).some((token) => label.includes(token))) && !isCommonAccessory(product.label)
  }).slice(0, 8)
  const filteredProducts = products
    .filter((product) => product.stockAvailable > 0)
    .filter((product) => normalizeSuggestionText(product.label).includes(normalizeSuggestionText(query)))
    .slice(0, 12)

  function renderSuggestion(product: CustomerOrderProductOption) {
    return (
      <button
        key={product.id}
        type="button"
        className={`btn btn-sm justify-start ${selectedIds.has(product.id) ? "btn-primary" : "btn-outline"}`}
        onClick={() => onAddAccessory(product.id)}
        disabled={!enabled || product.stockAvailable <= 0}
        title={`${product.label} · disp. ${product.stockAvailable}`}
      >
        <span className="truncate">{product.label}</span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {!devices.length ? <div className="alert py-3 text-sm">Primero agrega el o los celulares del pedido.</div> : null}

      <div className="grid gap-2">
        <label className="form-control">
          <span className="label-text mb-1">Buscar accesorio</span>
          <input
            className="input input-bordered"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cable, fuente, funda..."
            disabled={!enabled}
          />
        </label>
        {query.trim() && enabled ? (
          <div className="grid gap-2 rounded-lg border border-base-300 bg-base-100 p-2 sm:grid-cols-2">
            {filteredProducts.length ? filteredProducts.map((product) => (
              <button key={product.id} type="button" className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-base-200" onClick={() => onAddAccessory(product.id)}>
                <span className="min-w-0 truncate">{product.label}</span>
                <span className="shrink-0 text-xs text-base-content/60">disp. {product.stockAvailable} · USD {product.salePrice}</span>
              </button>
            )) : <div className="px-3 py-2 text-sm text-base-content/60">Sin accesorios disponibles para esa búsqueda.</div>}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SuggestionGroup title="Sugerencias rápidas" products={commonSuggestions} renderSuggestion={renderSuggestion} />
        <SuggestionGroup title="Sugeridos para los modelos agregados" products={modelSuggestions} renderSuggestion={renderSuggestion} empty="Sin coincidencias por modelo en stock." />
      </div>

      {accessories.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {accessories.map((line) => {
            const product = products.find((item) => item.id === line.productId)
            if (!product) return null
            return (
              <div key={line.productId} className="grid gap-2 rounded-lg bg-base-200 p-3 md:grid-cols-[1fr_90px_130px_auto] md:items-center">
                <span className="min-w-0 truncate font-medium">{product.label}</span>
                <input
                  className="input input-bordered input-sm"
                  type="number"
                  min={1}
                  max={product.stockAvailable}
                  value={line.quantity}
                  onChange={(event) => setAccessories(accessories.map((item) => item.productId === line.productId ? { ...item, quantity: Math.max(1, Math.min(product.stockAvailable, Number(event.target.value) || 1)) } : item))}
                  disabled={disabled}
                />
                <input
                  className="input input-bordered input-sm"
                  inputMode="decimal"
                  value={line.unitPriceUsd}
                  onChange={(event) => setAccessories(accessories.map((item) => item.productId === line.productId ? { ...item, unitPriceUsd: event.target.value } : item))}
                  disabled={disabled}
                />
                <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setAccessories(accessories.filter((item) => item.productId !== line.productId))} disabled={disabled}>
                  Quitar
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function SuggestionGroup({
  title,
  products,
  renderSuggestion,
  empty = "Sin sugerencias disponibles.",
}: {
  title: string
  products: CustomerOrderProductOption[]
  renderSuggestion: (product: CustomerOrderProductOption) => ReactNode
  empty?: string
}) {
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {products.length ? (
        <div className="flex flex-wrap gap-2">{products.map(renderSuggestion)}</div>
      ) : (
        <p className="text-sm text-base-content/60">{empty}</p>
      )}
    </div>
  )
}
