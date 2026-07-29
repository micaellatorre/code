"use client"

import { formatUsd } from "@/components/sales/salesUtils"
import type { Buyer } from "@prisma/client"
import type { SaleItemDraft } from "@/components/sales/types"

export default function SaleStickySummary({
  buyer,
  items,
  total,
  paid,
  remaining,
  tradeInCredit,
  isSubmitting,
  onConfirm,
  onReserve,
}: {
  buyer: Buyer | null
  items: SaleItemDraft[]
  total: number
  paid: number
  remaining: number
  tradeInCredit: number
  isSubmitting: boolean
  onConfirm: () => void
  onReserve: () => void
}) {
  return (
    <aside className="sticky top-4 rounded-lg border border-base-300 bg-base-100 p-4">
      <h2 className="font-semibold">Resumen</h2>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="text-base-content/50">Cliente</p>
          <p className="font-medium">{buyer ? `${buyer.name} ${buyer.surname ?? ""}`.trim() : "Consumidor Final"}</p>
        </div>
        <div>
          <p className="text-base-content/50">Items</p>
          <p className="font-medium">{items.length}</p>
          {items.some((item) => item.parentClientLineId) ? (
            <p className="text-xs text-primary">{items.filter((item) => item.parentClientLineId).length} accesorios asociados</p>
          ) : null}
        </div>
        <div className="divide-y divide-base-300 rounded-lg border border-base-300">
          <p className="flex justify-between p-2"><span>Total</span><span>{formatUsd(total)}</span></p>
          <p className="flex justify-between p-2"><span>Plan Canje</span><span>{formatUsd(tradeInCredit)}</span></p>
          <p className="flex justify-between p-2"><span>Pagado</span><span>{formatUsd(paid)}</span></p>
          <p className="flex justify-between p-2 font-semibold"><span>Restante</span><span>{formatUsd(remaining)}</span></p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={onConfirm}>
          Confirmar Venta
        </button>
        <button type="button" className="btn btn-outline" disabled={isSubmitting} onClick={onReserve}>
          Registrar Seña / Reservar
        </button>
      </div>
    </aside>
  )
}
