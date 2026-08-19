"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type BuyerOption = { id: string; label: string; dni: string | null; phone: string | null; email: string | null }
type ProductOption = { id: string; label: string; salePrice: string; stockAvailable: number }
type CashAccountOption = { id: string; name: string; currency: "ARS" | "USD" | "USDT" }

type AccessoryLine = { productId: string; quantity: number; unitPriceUsd: string }

const methods = [
  { value: "EFECTIVO_USD", label: "Efectivo USD", currency: "USD" },
  { value: "TRANSFERENCIA_USD", label: "Transferencia USD", currency: "USD" },
  { value: "USDT", label: "USDT", currency: "USDT" },
  { value: "EFECTIVO_PESOS", label: "Efectivo ARS", currency: "ARS" },
  { value: "TRANSFERENCIA_ARS", label: "Transferencia ARS", currency: "ARS" },
  { value: "TARJETA", label: "Tarjeta ARS", currency: "ARS" },
  { value: "BNA_CUOTAS", label: "BNA cuotas", currency: "ARS" },
] as const

export default function CustomerOrderCreateForm({
  buyers,
  products,
  cashAccounts,
  branchId,
  defaultDeliveryDays,
}: {
  buyers: BuyerOption[]
  products: ProductOption[]
  cashAccounts: CashAccountOption[]
  branchId: string
  defaultDeliveryDays: number
}) {
  const router = useRouter()
  const [buyerId, setBuyerId] = useState("")
  const [description, setDescription] = useState("")
  const [mainPrice, setMainPrice] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const date = new Date(Date.now() + defaultDeliveryDays * 86400000)
    return date.toISOString().slice(0, 10)
  })
  const [source, setSource] = useState("INTERNAL")
  const [notes, setNotes] = useState("")
  const [accessories, setAccessories] = useState<AccessoryLine[]>([])
  const [accessoryId, setAccessoryId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<(typeof methods)[number]["value"]>("EFECTIVO_USD")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [cashAccountId, setCashAccountId] = useState("")
  const [installments, setInstallments] = useState("12")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currency = methods.find((method) => method.value === paymentMethod)?.currency ?? "USD"
  const eligibleAccounts = cashAccounts.filter((account) => account.currency === currency)
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId)
  const total = useMemo(() => {
    const main = Number(mainPrice || 0)
    const extras = accessories.reduce((sum, line) => sum + Number(line.unitPriceUsd || 0) * line.quantity, 0)
    return main + extras
  }, [mainPrice, accessories])

  function addAccessory() {
    const product = products.find((item) => item.id === accessoryId)
    if (!product) return
    setAccessories((current) => current.some((item) => item.productId === product.id)
      ? current
      : [...current, { productId: product.id, quantity: 1, unitPriceUsd: product.salePrice }])
    setAccessoryId("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!buyerId || !description.trim() || Number(mainPrice) <= 0 || Number(paymentAmount) <= 0 || !cashAccountId) {
      setError("Completa cliente, producto, precio, seña y caja.")
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyerId,
          branchId,
          source,
          estimatedDeliveryAt: deliveryDate ? `${deliveryDate}T12:00:00` : null,
          notes: notes.trim() || null,
          items: [
            { kind: "ON_DEMAND", description: description.trim(), quantity: 1, unitPriceUsd: mainPrice },
            ...accessories.map((line) => {
              const product = products.find((item) => item.id === line.productId)
              return { kind: "STOCK", stockProductId: line.productId, description: product?.label ?? "Accesorio", quantity: line.quantity, unitPriceUsd: line.unitPriceUsd }
            }),
          ],
          payments: [{
            method: paymentMethod,
            currency,
            amount: paymentAmount,
            cashAccountId,
            installments: paymentMethod === "BNA_CUOTAS" ? Number(installments) : null,
          }],
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo crear el pedido.")
      router.push(`/dashboard/orders/${payload.id}`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el pedido.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-4xl flex-col gap-6">
      {error && <div className="alert alert-error"><span>{error}</span></div>}

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <h2 className="mb-4 text-lg font-semibold">Cliente y origen</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control"><span className="label-text mb-1">Cliente</span><select className="select select-bordered" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}><option value="">Seleccionar...</option>{buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.label}</option>)}</select></label>
          <label className="form-control"><span className="label-text mb-1">Origen</span><select className="select select-bordered" value={source} onChange={(e) => setSource(e.target.value)}><option value="INTERNAL">Interno</option><option value="INSTAGRAM">Instagram</option><option value="OFFICE">Oficina</option><option value="WHATSAPP">WhatsApp</option><option value="OTHER">Otro</option></select></label>
        </div>
        {selectedBuyer && (!selectedBuyer.dni || !selectedBuyer.phone || !selectedBuyer.email) && <div className="mt-3 text-sm text-warning">Este cliente no tiene DNI, teléfono y email completos. Actualizalo antes de confirmar el pedido.</div>}
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <h2 className="mb-4 text-lg font-semibold">Producto bajo demanda</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <label className="form-control"><span className="label-text mb-1">Descripción / variante</span><input className="input input-bordered" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="iPhone 17 Pro 512GB Silver" /></label>
          <label className="form-control"><span className="label-text mb-1">Precio USD</span><input className="input input-bordered" inputMode="decimal" value={mainPrice} onChange={(e) => setMainPrice(e.target.value)} /></label>
        </div>
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <h2 className="mb-4 text-lg font-semibold">Accesorios reservados ahora</h2>
        <div className="flex flex-wrap gap-2"><select className="select select-bordered min-w-72 flex-1" value={accessoryId} onChange={(e) => setAccessoryId(e.target.value)}><option value="">Seleccionar accesorio...</option>{products.map((product) => <option key={product.id} value={product.id}>{product.label} · disp. {product.stockAvailable} · USD {product.salePrice}</option>)}</select><button className="btn" type="button" onClick={addAccessory}>Agregar</button></div>
        <div className="mt-3 flex flex-col gap-2">{accessories.map((line) => { const product = products.find((item) => item.id === line.productId); return <div key={line.productId} className="flex flex-wrap items-center gap-2 rounded-lg bg-base-200 p-3"><span className="min-w-56 flex-1">{product?.label}</span><input className="input input-bordered input-sm w-20" type="number" min={1} max={product?.stockAvailable ?? 1} value={line.quantity} onChange={(e) => setAccessories((current) => current.map((item) => item.productId === line.productId ? { ...item, quantity: Math.max(1, Number(e.target.value)) } : item))} /><input className="input input-bordered input-sm w-28" inputMode="decimal" value={line.unitPriceUsd} onChange={(e) => setAccessories((current) => current.map((item) => item.productId === line.productId ? { ...item, unitPriceUsd: e.target.value } : item))} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccessories((current) => current.filter((item) => item.productId !== line.productId))}>Quitar</button></div> })}</div>
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Seña / pago inicial</h2><strong>Pedido: USD {total.toFixed(2)}</strong></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="form-control"><span className="label-text mb-1">Medio</span><select className="select select-bordered" value={paymentMethod} onChange={(e) => { const next = e.target.value as typeof paymentMethod; setPaymentMethod(next); setCashAccountId("") }}>{methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
          <label className="form-control"><span className="label-text mb-1">Importe {currency}</span><input className="input input-bordered" inputMode="decimal" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
          <label className="form-control"><span className="label-text mb-1">Caja</span><select className="select select-bordered" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}><option value="">Seleccionar...</option>{eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          {paymentMethod === "BNA_CUOTAS" && <label className="form-control"><span className="label-text mb-1">Cuotas</span><input className="input input-bordered" type="number" min={1} max={12} value={installments} onChange={(e) => setInstallments(e.target.value)} /></label>}
        </div>
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="grid gap-4 md:grid-cols-2"><label className="form-control"><span className="label-text mb-1">Entrega estimada</span><input className="input input-bordered" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></label><label className="form-control"><span className="label-text mb-1">Notas</span><textarea className="textarea textarea-bordered" value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div>
      </section>

      <div className="flex justify-end"><button className="btn btn-primary" disabled={submitting}>{submitting ? "Creando..." : "Confirmar pedido"}</button></div>
    </form>
  )
}
