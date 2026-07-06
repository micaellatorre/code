"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Option = { id: string; name?: string | null; email?: string | null; modelName?: string; imei?: string | null; surname?: string | null }

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
        next.modelName = product?.modelName ?? next.modelName
        next.imeiSerial = product?.imei ?? next.imeiSerial
      }
      return next
    })
  }

  async function submit(event: React.FormEvent) {
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-4">
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Tipo de servicio</legend>
        <div className="join">
          {(["CUSTOMER", "STOCK"] as const).map((type) => <button key={type} type="button" className={`btn join-item ${form.type === type ? "btn-primary" : "btn-outline"}`} onClick={() => setField("type", type)}>{type}</button>)}
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Cliente / equipo</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control"><span className="label-text">Comprador</span><select className="select select-bordered" value={form.buyerId} onChange={(event) => setField("buyerId", event.target.value)}><option value="">Seleccionar</option>{buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{[buyer.name, buyer.surname].filter(Boolean).join(" ")}</option>)}</select></label>
          <label className="form-control"><span className="label-text">Producto stock</span><select className="select select-bordered" value={form.productId} onChange={(event) => setField("productId", event.target.value)}><option value="">Sin producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.modelName}</option>)}</select></label>
          <label className="form-control"><span className="label-text">Modelo *</span><input required className="input input-bordered" value={form.modelName} onChange={(event) => setField("modelName", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">IMEI / serie</span><input className="input input-bordered" value={form.imeiSerial} onChange={(event) => setField("imeiSerial", event.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Diagnostico y responsable</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control md:col-span-2"><span className="label-text">Falla *</span><textarea required className="textarea textarea-bordered" value={form.failureDescription} onChange={(event) => setField("failureDescription", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Tecnico</span><select className="select select-bordered" value={form.technicianId} onChange={(event) => setField("technicianId", event.target.value)}><option value="">Sin asignar</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label>
          <label className="form-control"><span className="label-text">Moneda</span><select className="select select-bordered" value={form.currency} onChange={(event) => setField("currency", event.target.value)}><option>USD</option><option>ARS</option><option>USDT</option></select></label>
          <label className="form-control"><span className="label-text">Precio</span><input type="number" step="0.01" className="input input-bordered" value={form.priceAmount} onChange={(event) => setField("priceAmount", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Costo</span><input type="number" step="0.01" className="input input-bordered" value={form.costAmount} onChange={(event) => setField("costAmount", event.target.value)} /></label>
          <label className="form-control md:col-span-2"><span className="label-text">Notas</span><textarea className="textarea textarea-bordered" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
        </div>
      </fieldset>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSaving}>Volver</button><button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Registrando..." : "Crear orden"}</button></div>
    </form>
  )
}
