"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toArgDateTimeInputValue } from "@/lib/timezone"

type Buyer = { id: string; name: string; surname?: string | null; businessName?: string | null }
type Product = { id: string; modelName: string; imei?: string | null; salePrice?: string | null }
type Gift = { label: string }
type CashAccount = { id: string; name: string; currency: string; scope: string; branch?: { name: string } | null }

export default function ReservationForm() {
  const router = useRouter()
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [giftText, setGiftText] = useState("")
  const [gifts, setGifts] = useState<Gift[]>([])
  const [form, setForm] = useState({
    buyerId: "",
    productId: "",
    itemName: "",
    imeiSerial: "",
    quantity: "1",
    unitPrice: "",
    reservedAt: toArgDateTimeInputValue(new Date()),
    pickupAt: "",
    agreedTotal: "",
    notes: "",
    paymentMethod: "EFECTIVO_USD",
    paymentCurrency: "USD",
    paymentAmount: "",
    paymentExchangeRate: "",
    paymentCashAccountId: "",
    paymentNote: "",
  })

  useEffect(() => {
    async function load() {
      const [buyersRes, productsRes, accountsRes] = await Promise.all([fetch("/api/buyers"), fetch("/api/products?sellable=true&limit=200"), fetch("/api/cash-accounts")])
      if (buyersRes.ok) setBuyers(await buyersRes.json())
      if (productsRes.ok) setProducts((await productsRes.json()).products ?? [])
      if (accountsRes.ok) setCashAccounts((await accountsRes.json()).accounts ?? [])
    }
    load()
  }, [])

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "productId") {
        const product = products.find((item) => item.id === value)
        next.itemName = product?.modelName ?? next.itemName
        next.imeiSerial = product?.imei ?? next.imeiSerial
        next.unitPrice = product?.salePrice ?? next.unitPrice
        next.agreedTotal = product?.salePrice ?? next.agreedTotal
      }
      if (field === "paymentCurrency") {
        next.paymentCashAccountId = ""
      }
      return next
    })
  }

  function addGift() {
    if (!giftText.trim()) return
    setGifts((prev) => [...prev, { label: giftText.trim() }])
    setGiftText("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const payments = form.paymentAmount
      ? [{
          method: form.paymentMethod,
          currency: form.paymentCurrency,
          amount: form.paymentAmount,
          exchangeRate: form.paymentExchangeRate || null,
          cashAccountId: form.paymentCashAccountId || null,
          note: form.paymentNote || null,
        }]
      : []
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerId: form.buyerId || null,
        reservedAt: form.reservedAt ? new Date(form.reservedAt).toISOString() : null,
        pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
        agreedTotal: form.agreedTotal || null,
        notes: form.notes || null,
        items: [{
          productId: form.productId || null,
          itemName: form.itemName,
          imeiSerial: form.imeiSerial || null,
          quantity: form.quantity,
          unitPrice: form.unitPrice || null,
          gifts,
        }],
        payments,
      }),
    })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo crear la reserva")
      return
    }
    router.push("/dashboard/database?tab=reservations")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-4">
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Cliente</legend>
        <label className="form-control">
          <span className="label-text">Comprador</span>
          <select className="select select-bordered" value={form.buyerId} onChange={(event) => setField("buyerId", event.target.value)}>
            <option value="">Consumidor final / sin comprador</option>
            {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{[buyer.name, buyer.surname].filter(Boolean).join(" ")} {buyer.businessName ? `- ${buyer.businessName}` : ""}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Items</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Producto</span>
            <select className="select select-bordered" value={form.productId} onChange={(event) => setField("productId", event.target.value)}>
              <option value="">Snapshot manual</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.modelName} {product.imei ? `- ${product.imei}` : ""}</option>)}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Item *</span>
            <input required className="input input-bordered" value={form.itemName} onChange={(event) => setField("itemName", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">IMEI / serie</span>
            <input className="input input-bordered" value={form.imeiSerial} onChange={(event) => setField("imeiSerial", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Precio acordado</span>
            <input type="number" step="0.01" className="input input-bordered" value={form.unitPrice} onChange={(event) => setField("unitPrice", event.target.value)} />
          </label>
        </div>
        <div className="mt-3 rounded-lg bg-base-200/60 p-3">
          <span className="text-sm font-medium">Regalos</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {gifts.map((gift, index) => <button key={`${gift.label}-${index}`} type="button" className="badge badge-primary gap-1" onClick={() => setGifts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>{gift.label} x</button>)}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="input input-bordered input-sm flex-1" value={giftText} onChange={(event) => setGiftText(event.target.value)} placeholder="Cable Lightning" />
            <button type="button" className="btn btn-outline btn-sm" onClick={addGift}>+ Agregar regalo</button>
          </div>
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-base-300 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Reserva y seña</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control"><span className="label-text">Reservado *</span><input type="datetime-local" className="input input-bordered" value={form.reservedAt} onChange={(event) => setField("reservedAt", event.target.value)} required /></label>
          <label className="form-control"><span className="label-text">Cuando pasa</span><input type="datetime-local" className="input input-bordered" value={form.pickupAt} onChange={(event) => setField("pickupAt", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Total acordado</span><input type="number" step="0.01" className="input input-bordered" value={form.agreedTotal} onChange={(event) => setField("agreedTotal", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Seña</span><input type="number" step="0.01" className="input input-bordered" value={form.paymentAmount} onChange={(event) => setField("paymentAmount", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Metodo</span><select className="select select-bordered" value={form.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value)}><option>EFECTIVO_USD</option><option>EFECTIVO_PESOS</option><option>TRANSFERENCIA_USD</option><option>TRANSFERENCIA_ARS</option><option>TARJETA</option><option>USDT</option></select></label>
          <label className="form-control"><span className="label-text">Moneda</span><select className="select select-bordered" value={form.paymentCurrency} onChange={(event) => setField("paymentCurrency", event.target.value)}><option>USD</option><option>ARS</option><option>USDT</option></select></label>
          <label className="form-control"><span className="label-text">Tipo de cambio</span><input type="number" step="0.01" className="input input-bordered" value={form.paymentExchangeRate} onChange={(event) => setField("paymentExchangeRate", event.target.value)} /></label>
          <label className="form-control"><span className="label-text">Caja de la seña</span><select className="select select-bordered" value={form.paymentCashAccountId} onChange={(event) => setField("paymentCashAccountId", event.target.value)}><option value="">Seleccionar caja</option>{cashAccounts.filter((account) => account.currency === form.paymentCurrency).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}{account.scope === "BRANCH" && account.branch?.name ? ` · ${account.branch.name}` : ""}</option>)}</select></label>
          <label className="form-control md:col-span-2"><span className="label-text">Notas</span><textarea className="textarea textarea-bordered" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
        </div>
      </fieldset>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSaving}>Volver</button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? <><span className="loading loading-spinner loading-xs" /> Registrando...</> : "Crear reserva"}</button>
      </div>
    </form>
  )
}
