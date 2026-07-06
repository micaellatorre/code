"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ClockIcon } from "@heroicons/react/24/outline"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"

type TimelineEvent = {
  id: string
  action: string
  title: string
  description: string
  createdAt: string
  actor: { id: string; name: string | null; email: string } | null
  actorRole: string | null
  simulatedRole: string | null
  executedByAdminInSimulation: boolean
  metadata: unknown
}

type TimelinePayload = {
  purchase: {
    id: string
    date: string
    supplier: { id: string; name: string }
    branch: { id: string; name: string } | null
    totalCost: string
    currency: string
    totalUnits: number
    productTypes: string[]
    paymentStatus: "PAID" | "PARTIAL" | "CURRENT_ACCOUNT"
  }
  events: TimelineEvent[]
}

type Props = {
  purchaseId: string | null
  onClose: () => void
}

function eventTone(action: string) {
  switch (action) {
    case "PAYMENT_CREATED":
      return "bg-success"
    case "STOCK_CHANGE":
      return "bg-secondary"
    case "UPDATE":
      return "bg-warning"
    case "DELETE":
      return "bg-error"
    default:
      return "bg-info"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function metadataLines(event: TimelineEvent) {
  if (!isRecord(event.metadata)) return []
  if (event.action === "PAYMENT_CREATED") {
    return [
      [event.metadata.method, event.metadata.currency, event.metadata.amount].filter(Boolean).join(" · "),
      event.metadata.amountUsd ? `Equivalente USD: ${event.metadata.amountUsd}` : null,
    ].filter((line): line is string => Boolean(line))
  }
  if (event.action === "STOCK_CHANGE") {
    const units = event.metadata.unitsCreated
    const branchName = event.metadata.branchName
    const header = [units ? `${units} unidades ingresadas` : null, branchName ? `en ${branchName}` : null].filter(Boolean).join(" ")
    const items = Array.isArray(event.metadata.items)
      ? event.metadata.items.slice(0, 6).map((item) => isRecord(item) ? `${String(item.modelName ?? "Item")} · ${String(item.units ?? 1)} un.` : null).filter((line): line is string => Boolean(line))
      : []
    return [header || null, ...items].filter((line): line is string => Boolean(line))
  }
  if (event.action === "CREATE") {
    return [
      event.metadata.totalCost && event.metadata.currency
        ? `Se registro la compra por ${String(event.metadata.currency)} ${String(event.metadata.totalCost)}.`
        : null,
    ].filter((line): line is string => Boolean(line))
  }
  return []
}

function statusLabel(status: TimelinePayload["purchase"]["paymentStatus"]) {
  if (status === "PAID") return "Pagada"
  if (status === "PARTIAL") return "Parcial"
  return "En cuenta corriente"
}

export default function PurchaseTimelineModal({ purchaseId, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [payload, setPayload] = useState<TimelinePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (purchaseId && !dialog.open) dialog.showModal()
    if (!purchaseId && dialog.open) dialog.close()
  }, [purchaseId])

  useEffect(() => {
    if (!purchaseId) return
    setPayload(null)
    setError(null)
    setLoading(true)
    fetch(`/api/purchases/${purchaseId}/timeline`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error ?? "No se pudo cargar el seguimiento")
        setPayload(data as TimelinePayload)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el seguimiento"))
      .finally(() => setLoading(false))
  }, [purchaseId])

  const productLabel = useMemo(() => {
    if (!payload) return "-"
    const hasPhone = payload.purchase.productTypes.includes("PHONE")
    const noun = hasPhone ? "equipos" : "unidades"
    return `${payload.purchase.totalUnits} ${noun}`
  }, [payload])

  return (
    <dialog ref={dialogRef} className="modal" onCancel={onClose}>
      <div className="modal-box max-h-[86vh] max-w-3xl overflow-y-auto rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Seguimiento de compra</h2>
            {payload ? (
              <p className="mt-1 text-sm text-base-content/60">
                {payload.purchase.supplier.name} · {formatInTimeZone(new Date(payload.purchase.date), AR_TIME_ZONE, "dd/MM/yyyy")} · {payload.purchase.branch?.name ?? "Sin sucursal"}
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Cerrar" onClick={onClose}>x</button>
        </div>

        {loading ? <div className="mt-6 h-48 animate-pulse rounded bg-base-200" /> : null}
        {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}

        {payload ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Total</div><div className="font-semibold">{payload.purchase.currency} {Number(payload.purchase.totalCost).toFixed(2)}</div></div>
              <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Items</div><div className="font-semibold">{productLabel}</div></div>
              <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Pago</div><div className="font-semibold">{statusLabel(payload.purchase.paymentStatus)}</div></div>
            </div>

            {payload.events.length ? (
              <div className="relative space-y-0 pl-6">
                <div className="absolute bottom-3 left-[11px] top-3 w-px bg-base-300" />
                {payload.events.map((event) => (
                  <article key={event.id} className="relative pb-6">
                    <span className={`absolute -left-6 top-1 size-3 rounded-full ${eventTone(event.action)}`} />
                    <h3 className="font-semibold">{event.title}</h3>
                    <p className="text-xs text-base-content/50">
                      {formatInTimeZone(new Date(event.createdAt), AR_TIME_ZONE, "dd/MM/yyyy · HH:mm")} · {event.actor?.name ?? event.actor?.email ?? "Sistema"}
                    </p>
                    <p className="mt-2 text-sm">{event.description}</p>
                    {metadataLines(event).length ? (
                      <div className="mt-2 rounded border border-base-300 bg-base-200/40 p-3 text-sm">
                        {metadataLines(event).map((line, index) => <p key={`${event.id}-${index}`}>{line}</p>)}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-base-300 p-6 text-center text-sm text-base-content/60">
                <ClockIcon className="mx-auto mb-2 size-6" />
                No hay eventos de seguimiento registrados para esta compra.
              </div>
            )}
          </div>
        ) : null}
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>cerrar</button></form>
    </dialog>
  )
}
