"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ReservationDetailActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")

  async function action(path: string, label: string) {
    setIsWorking(label)
    setError(null)
    const response = await fetch(`/api/reservations/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" } })
    setIsWorking(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo completar la accion")
      return
    }
    router.refresh()
  }

  async function addPayment() {
    if (!paymentAmount) return
    setIsWorking("payment")
    const response = await fetch(`/api/reservations/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "EFECTIVO_USD", currency: "USD", amount: paymentAmount }),
    })
    setIsWorking(null)
    setPaymentAmount("")
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo registrar el pago")
      return
    }
    router.refresh()
  }

  if (status !== "ACTIVE") return null

  return (
    <div className="rounded-lg border border-base-300 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="form-control sm:w-48">
          <span className="label-text">Nueva seña USD</span>
          <input type="number" step="0.01" className="input input-bordered input-sm" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
        </label>
        <button type="button" className="btn btn-outline btn-sm" disabled={isWorking === "payment"} onClick={addPayment}>{isWorking === "payment" ? "Registrando..." : "Registrar pago"}</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(isWorking)} onClick={() => action("convert", "convert")}>{isWorking === "convert" ? "Convirtiendo..." : "Convertir en venta"}</button>
        <button type="button" className="btn btn-error btn-sm" disabled={Boolean(isWorking)} onClick={() => action("cancel", "cancel")}>{isWorking === "cancel" ? "Cancelando..." : "Cancelar reserva"}</button>
      </div>
      {error ? <div className="mt-2 text-sm text-error">{error}</div> : null}
    </div>
  )
}
