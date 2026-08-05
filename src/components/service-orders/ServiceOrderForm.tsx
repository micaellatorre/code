"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getProductDisplayModel, type ProductCatalogDisplayCapacity, type ProductCatalogDisplayColor, type ProductCatalogDisplayModel } from "@/lib/products/display"

type Option = {
  id: string
  name?: string | null
  email?: string | null
  modelName?: string
  imei?: string | null
  surname?: string | null
  catalogModel?: ProductCatalogDisplayModel | null
  catalogCapacity?: ProductCatalogDisplayCapacity | null
  catalogColor?: ProductCatalogDisplayColor | null
}

export default function ServiceOrderForm() {
  const router = useRouter()
  const [buyers, setBuyers] = useState<Option[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [users, setUsers] = useState<Option[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    type: "CUSTOMER",
    productId: "",
    buyerId: "",
    modelName: "",
    imeiSerial: "",
    failureDescription: "",
    technicianId: "",
    priceAmount: "",
    costAmount: "",
    currency: "USD",
    notes: "",
  })

  useEffect(() => {
    async function load() {
      const [buyersRes, productsRes, usersRes] = await Promise.all([fetch("/api/buyers"), fetch("/api/products?limit=200"), fetch("/api/users/search?q=")])
      if (buyersRes.ok) setBuyers(await buyersRes.json())
      if (productsRes.ok) setProducts((await productsRes.json()).products ?? [])
      if (usersRes.ok) setUsers((await usersRes.json()).users ?? [])
    }
    load()
  }, [])

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "productId") {
        const product = products.find((item) => item.id === value)
        next.modelName = product ? getProductDisplayModel(product) : next.modelName
        next.imeiSerial = product?.imei ?? next.imeiSerial
      }
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch("/api/service-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        productId: form.productId || null,
        buyerId: form.buyerId || null,
        technicianId: form.technicianId || null,
        costAmount: form.costAmount || null,
        priceAmount: form.priceAmount || null,
      }),
    })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo crear la orden")
      return
    }
    router.push("/dashboard/database?tab=service")
    router.refresh()
  }

  const selectedBuyer = buyers.find((buyer) => buyer.id === form.buyerId)
  const selectedProduct = products.find((product) => product.id === form.productId)
  const selectedTechnician = users.find((user) => user.id === form.technicianId)
  const serviceTypeLabel = form.type === "CUSTOMER" ? "Cliente" : "Stock"
  const buyerName = selectedBuyer ? [selectedBuyer.name, selectedBuyer.surname].filter(Boolean).join(" ") : ""

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:p-4 lg:grid-cols-[1fr_320px]">
      {error ? <div className="alert alert-error py-3 text-sm lg:col-span-2">{error}</div> : null}

      <div className="space-y-3">
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tipo de servicio</h2>
              <p className="text-sm text-base-content/60">Origen operativo de la orden.</p>
            </div>
            <div className="join">
              {(["CUSTOMER", "STOCK"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm join-item ${form.type === type ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setField("type", type)}
                  disabled={isSaving}
                >
                  {type === "CUSTOMER" ? "Cliente" : "Stock"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Cliente / equipo</h2>
            <p className="text-sm text-base-content/60">Producto asociado y datos del equipo recibido.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Comprador" value={form.buyerId} onChange={(value) => setField("buyerId", value)} disabled={isSaving}>
              <option value="">Seleccionar</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {[buyer.name, buyer.surname].filter(Boolean).join(" ")}
                </option>
              ))}
            </SelectField>

            <SelectField label="Producto stock" value={form.productId} onChange={(value) => setField("productId", value)} disabled={isSaving}>
              <option value="">Sin producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductDisplayModel(product)}
                </option>
              ))}
            </SelectField>

            <TextField label="Modelo *" value={form.modelName} onChange={(value) => setField("modelName", value)} disabled={isSaving} required />
            <TextField label="IMEI / serie" value={form.imeiSerial} onChange={(value) => setField("imeiSerial", value)} disabled={isSaving} />
          </div>
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Diagnostico y responsable</h2>
            <p className="text-sm text-base-content/60">Detalle tecnico, asignacion y valores de la reparacion.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextareaField
              label="Falla *"
              value={form.failureDescription}
              onChange={(value) => setField("failureDescription", value)}
              disabled={isSaving}
              required
              className="md:col-span-2"
            />

            <SelectField label="Tecnico" value={form.technicianId} onChange={(value) => setField("technicianId", value)} disabled={isSaving}>
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </SelectField>

            <SelectField label="Moneda" value={form.currency} onChange={(value) => setField("currency", value)} disabled={isSaving}>
              <option>USD</option>
              <option>ARS</option>
              <option>USDT</option>
            </SelectField>

            <TextField
              type="number"
              step="0.01"
              label="Precio"
              value={form.priceAmount}
              onChange={(value) => setField("priceAmount", value)}
              disabled={isSaving}
            />
            <TextField
              type="number"
              step="0.01"
              label="Costo"
              value={form.costAmount}
              onChange={(value) => setField("costAmount", value)}
              disabled={isSaving}
            />

            <TextareaField
              label="Notas"
              value={form.notes}
              onChange={(value) => setField("notes", value)}
              disabled={isSaving}
              className="md:col-span-2"
            />
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-base-300 bg-base-100 p-4">
        <h2 className="font-semibold">Resumen</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-base-content/60">Tipo</dt>
            <dd className="font-medium">{serviceTypeLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-base-content/60">Cliente</dt>
            <dd className="text-right font-medium">{buyerName || "Pendiente"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-base-content/60">Producto</dt>
            <dd className="text-right font-medium">{selectedProduct?.modelName || form.modelName || "Pendiente"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-base-content/60">Tecnico</dt>
            <dd className="text-right font-medium">{selectedTechnician?.name || selectedTechnician?.email || "Sin asignar"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-base-content/60">Precio</dt>
            <dd className="font-medium">
              {form.priceAmount ? `${form.currency} ${form.priceAmount}` : "Pendiente"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-2">
          <button type="submit" className="btn btn-primary w-full" disabled={isSaving}>
            {isSaving ? <span className="loading loading-spinner loading-xs" /> : null}
            {isSaving ? "Registrando..." : "Crear orden"}
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => router.back()} disabled={isSaving}>
            Volver
          </button>
        </div>
      </aside>
    </form>
  )
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <label className="form-control">
      <span className="label">
        <span className="label-text">{label}</span>
      </span>
      <select className="select select-bordered" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  step,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: string
  step?: string
  required?: boolean
}) {
  return (
    <label className="form-control">
      <span className="label">
        <span className="label-text">{label}</span>
      </span>
      <input
        type={type}
        step={step}
        className="input input-bordered"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
      />
    </label>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
  required = false,
  className = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  required?: boolean
  className?: string
}) {
  return (
    <label className={`form-control ${className}`}>
      <span className="label">
        <span className="label-text">{label}</span>
      </span>
      <textarea
        className="textarea textarea-bordered min-h-28"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
      />
    </label>
  )
}
