"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type ProductOption = { id: string; label: string; stockAvailable: number }
type CashAccountOption = { id: string; name: string; currency: "ARS" | "USD" | "USDT" }
type PendingItem = { id: string; description: string; quantity: number }

const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  CONFIRMED: { status: "PROCUREMENT_PENDING", label: "Enviar a compras" },
  PROCUREMENT_PENDING: { status: "ORDERED_TO_SUPPLIER", label: "Marcar comprado" },
  ORDERED_TO_SUPPLIER: { status: "IN_TRANSIT", label: "Marcar en camino" },
  IN_TRANSIT: { status: "RECEIVED", label: "Marcar recibido" },
  RECEIVED: { status: "READY_FOR_DELIVERY", label: "Listo para entregar" },
}

const methods = [
  ["EFECTIVO_USD", "Efectivo USD", "USD"],
  ["TRANSFERENCIA_USD", "Transferencia USD", "USD"],
  ["USDT", "USDT", "USDT"],
  ["EFECTIVO_PESOS", "Efectivo ARS", "ARS"],
  ["TRANSFERENCIA_ARS", "Transferencia ARS", "ARS"],
  ["TARJETA", "Tarjeta ARS", "ARS"],
  ["BNA_CUOTAS", "BNA cuotas", "ARS"],
] as const

export default function CustomerOrderActions({
  orderId,
  status,
  balanceDueUsd,
  pendingItems,
  products,
  cashAccounts,
}: {
  orderId: string
  status: string
  balanceDueUsd: number
  pendingItems: PendingItem[]
  products: ProductOption[]
  cashAccounts: CashAccountOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [method, setMethod] = useState("EFECTIVO_USD")
  const [amount, setAmount] = useState("")
  const [cashAccountId, setCashAccountId] = useState("")
  const selectedMethod = methods.find((row) => row[0] === method) ?? methods[0]
  const currency = selectedMethod[2]

  async function call(url: string, init?: RequestInit) {
    setBusy(true); setError(null)
    try {
      const response = await fetch(url, init)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo completar la operación.")
      router.refresh()
      return payload
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación.")
      return null
    } finally { setBusy(false) }
  }

  const next = nextStatus[status]
  const terminal = status === "CONVERTED" || status === "CANCELLED"

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="alert alert-error"><span>{error}</span></div>}

      {pendingItems.length > 0 && !terminal && (
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="font-semibold">Asignar productos recibidos</h3>
          <p className="mb-3 text-sm opacity-70">Cada producto asignado reserva disponibilidad para este pedido.</p>
          <div className="flex flex-col gap-3">
            {pendingItems.map((item) => (
              <div key={item.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <span>{item.description} · x{item.quantity}</span>
                <select className="select select-bordered select-sm" value={assignments[item.id] ?? ""} onChange={(e) => setAssignments((current) => ({ ...current, [item.id]: e.target.value }))}>
                  <option value="">Producto de stock...</option>
                  {products.filter((product) => product.stockAvailable >= item.quantity).map((product) => <option key={product.id} value={product.id}>{product.label} · disp. {product.stockAvailable}</option>)}
                </select>
                <button type="button" className="btn btn-sm" disabled={busy || !assignments[item.id]} onClick={() => call(`/api/customer-orders/${orderId}/items/${item.id}/assign-product`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: assignments[item.id] }) })}>Asignar</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {balanceDueUsd > 0 && !terminal && (
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="font-semibold">Registrar pago</h3>
          <p className="mb-3 text-sm opacity-70">Saldo base pendiente: USD {balanceDueUsd.toFixed(2)}. El servidor calcula cobertura y recargos según el medio.</p>
          <div className="grid gap-2 md:grid-cols-4">
            <select className="select select-bordered" value={method} onChange={(e) => { setMethod(e.target.value); setCashAccountId("") }}>{methods.map((row) => <option key={row[0]} value={row[0]}>{row[1]}</option>)}</select>
            <input className="input input-bordered" inputMode="decimal" placeholder={`Importe ${currency}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="select select-bordered" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}><option value="">Caja...</option>{cashAccounts.filter((account) => account.currency === currency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
            <button type="button" className="btn" disabled={busy || Number(amount) <= 0 || !cashAccountId} onClick={() => call(`/api/customer-orders/${orderId}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, currency, amount, cashAccountId }) })}>Agregar pago</button>
          </div>
        </section>
      )}

      {!terminal && (
        <section className="flex flex-wrap gap-2 rounded-box border border-base-300 bg-base-100 p-4">
          {next && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => call(`/api/customer-orders/${orderId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next.status }) })}>{next.label}</button>}
          {status === "READY_FOR_DELIVERY" && <button type="button" className="btn btn-success" disabled={busy || balanceDueUsd > 0} onClick={() => call(`/api/customer-orders/${orderId}/convert`, { method: "POST" })}>Entregar y convertir en venta</button>}
          <button type="button" className="btn btn-outline btn-error" disabled={busy} onClick={() => { if (window.confirm("¿Cancelar el pedido, liberar stock reservado y revertir sus cobros?")) call(`/api/customer-orders/${orderId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }) }) }}>Cancelar pedido</button>
        </section>
      )}
    </div>
  )
}
