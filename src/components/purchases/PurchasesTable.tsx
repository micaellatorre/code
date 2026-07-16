"use client"

import { useEffect, useState } from "react"
import { ArrowPathIcon, ClockIcon } from "@heroicons/react/24/outline"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import PurchaseTimelineModal from "./PurchaseTimelineModal"

export type PurchaseRow = {
  id: string
  supplier: { id: string; name: string } | null
  branch: { id: string; code: string; name: string } | null
  date: string
  currency: string
  totalCost: string
  paymentStatus: "PAID" | "PARTIAL" | "CURRENT_ACCOUNT"
  totalUnits: number
  productTypes: string[]
  items: Array<{
    id: string
    units: number
    product: { id: string; type: string; modelName: string; imei: string | null }
  }>
}

type Props = {
  purchases: PurchaseRow[]
  canUpdatePaymentStatus?: boolean
}

const paymentStatusOptions: PurchaseRow["paymentStatus"][] = ["PAID", "PARTIAL", "CURRENT_ACCOUNT"]

function paymentLabel(status: PurchaseRow["paymentStatus"]) {
  if (status === "PAID") return "Pagada"
  if (status === "PARTIAL") return "Parcial"
  return "Cuenta corriente"
}

export default function PurchasesTable({ purchases, canUpdatePaymentStatus = false }: Props) {
  const [timelinePurchaseId, setTimelinePurchaseId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PurchaseRow["paymentStatus"]>>({})
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    setPaymentStatuses(Object.fromEntries(purchases.map((purchase) => [purchase.id, purchase.paymentStatus])))
  }, [purchases])

  async function updatePaymentStatus(purchase: PurchaseRow, nextStatus: PurchaseRow["paymentStatus"]) {
    const previousStatus = paymentStatuses[purchase.id] ?? purchase.paymentStatus
    if (nextStatus === previousStatus) {
      setEditingPaymentId(null)
      return
    }

    setPaymentError(null)
    setSavingPaymentId(purchase.id)
    setPaymentStatuses((current) => ({ ...current, [purchase.id]: nextStatus }))

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "No se pudo actualizar el estado de pago")
      setPaymentStatuses((current) => ({ ...current, [purchase.id]: data.purchase.paymentStatus }))
      setEditingPaymentId(null)
    } catch (error) {
      setPaymentStatuses((current) => ({ ...current, [purchase.id]: previousStatus }))
      setPaymentError(error instanceof Error ? error.message : "No se pudo actualizar el estado de pago")
    } finally {
      setSavingPaymentId(null)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Items</th>
              <th>Total</th>
              <th>Sucursal</th>
              <th>Pago</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>{formatInTimeZone(new Date(purchase.date), AR_TIME_ZONE, "dd/MM/yyyy")}</td>
                <td>{purchase.supplier?.name ?? "-"}</td>
                <td>
                  <div className="max-w-sm">
                    <div className="font-medium">{purchase.totalUnits} unidades</div>
                    <div className="truncate text-xs text-base-content/60">
                      {purchase.items.slice(0, 3).map((item) => `${item.product.modelName}${item.product.imei ? ` #${item.product.imei}` : ""}`).join(", ")}
                    </div>
                  </div>
                </td>
                <td>{purchase.currency} {Number(purchase.totalCost).toFixed(2)}</td>
                <td>{purchase.branch?.name ?? "Sin sucursal"}</td>
                <td>
                  {!canUpdatePaymentStatus ? (
                    <span className="badge badge-outline">{paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}</span>
                  ) : editingPaymentId === purchase.id ? (
                    <select
                      className="select select-bordered select-xs w-40"
                      aria-label="Estado de pago"
                      autoFocus
                      value={paymentStatuses[purchase.id] ?? purchase.paymentStatus}
                      disabled={savingPaymentId === purchase.id}
                      onBlur={() => setEditingPaymentId(null)}
                      onChange={(event) => updatePaymentStatus(purchase, event.target.value as PurchaseRow["paymentStatus"])}
                    >
                      {paymentStatusOptions.map((status) => (
                        <option key={status} value={status}>{paymentLabel(status)}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className="badge badge-outline group min-w-32 cursor-pointer justify-center gap-1 transition-colors hover:border-primary hover:bg-primary hover:text-primary-content"
                      title="Actualizar estado de pago"
                      aria-label={`Actualizar estado de pago: ${paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}`}
                      disabled={savingPaymentId === purchase.id}
                      onClick={() => setEditingPaymentId(purchase.id)}
                    >
                      <span className="group-hover:hidden">
                        {paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}
                      </span>
                      <span className="hidden items-center gap-1 group-hover:inline-flex">
                        <ArrowPathIcon className="size-3" />
                        Actualizar
                      </span>
                    </button>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-square btn-ghost btn-xs"
                    title="Ver seguimiento"
                    aria-label="Ver seguimiento de la compra"
                    onClick={() => setTimelinePurchaseId(purchase.id)}
                  >
                    <ClockIcon className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!purchases.length ? (
              <tr><td colSpan={7} className="py-8 text-center text-base-content/60">No hay compras para los filtros seleccionados.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {paymentError ? <div className="alert alert-error mt-3 text-sm">{paymentError}</div> : null}
      <PurchaseTimelineModal purchaseId={timelinePurchaseId} onClose={() => setTimelinePurchaseId(null)} />
    </>
  )
}
