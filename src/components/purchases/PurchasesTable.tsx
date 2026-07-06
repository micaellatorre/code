"use client"

import { useState } from "react"
import { ClockIcon } from "@heroicons/react/24/outline"
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
}

function paymentLabel(status: PurchaseRow["paymentStatus"]) {
  if (status === "PAID") return "Pagada"
  if (status === "PARTIAL") return "Parcial"
  return "Cuenta corriente"
}

export default function PurchasesTable({ purchases }: Props) {
  const [timelinePurchaseId, setTimelinePurchaseId] = useState<string | null>(null)

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
                <td><span className="badge badge-outline">{paymentLabel(purchase.paymentStatus)}</span></td>
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
      <PurchaseTimelineModal purchaseId={timelinePurchaseId} onClose={() => setTimelinePurchaseId(null)} />
    </>
  )
}
