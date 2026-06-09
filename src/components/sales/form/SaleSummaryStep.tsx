"use client"

import type { SaleStatus } from "@prisma/client"
import { formatUsd } from "@/components/sales/salesUtils"
import type { PaymentDraft, SaleItemDraft } from "@/components/sales/types"

export default function SaleSummaryStep({
  items,
  payments,
  total,
  paid,
  remaining,
  tradeInCredit,
  canSeeFinancials,
  status,
  setStatus,
  canChangeStatus,
  error,
  isSubmitting,
  onConfirm,
  onReserve,
}: {
  items: SaleItemDraft[]
  payments: PaymentDraft[]
  total: number
  paid: number
  remaining: number
  tradeInCredit: number
  canSeeFinancials: boolean
  status: SaleStatus
  setStatus: (status: SaleStatus) => void
  canChangeStatus: boolean
  error: string | null
  isSubmitting: boolean
  onConfirm: () => void
  onReserve: () => void
}) {
  const costTotal = items.reduce((acc, item) => acc + (Number(item.unitCost || 0) + Number(item.extraCost || 0)) * item.units, 0)
  const remainingKpiClass =
    remaining > 0
      ? "border-warning/40 bg-warning/10 text-warning"
      : "border-success/40 bg-success/10 text-success"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-base-300 p-3"><p className="text-xs text-base-content/50">Total</p><p className="font-semibold">{formatUsd(total)}</p></div>
        <div className="rounded-lg border border-base-300 p-3"><p className="text-xs text-base-content/50">Pagado</p><p className="font-semibold">{formatUsd(paid)}</p></div>
        <div className={`rounded-lg border p-3 ${remainingKpiClass}`}><p className="text-xs text-current/70">Restan pagar</p><p className="font-semibold">{formatUsd(remaining)}</p></div>
      </div>
      <div className="rounded-lg border border-base-300 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">Items</p>
        {items.map((item) => (
          <div key={item._id} className="flex justify-between gap-3 border-b border-base-300 py-2 text-sm last:border-b-0">
            <span>{item.product.modelName} x{item.units}</span>
            <span>{formatUsd(Number(item.unitPrice) * item.units)}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-base-300 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">Pagos</p>
        {payments.map((payment) => (
          <div key={payment._id} className="flex justify-between gap-3 border-b border-base-300 py-2 text-sm last:border-b-0">
            <span>{payment.method}</span>
            <span>{formatUsd(payment.amount)}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-base-300 p-3">
        <p className="text-xs text-base-content/50">Plan Canje</p>
        <p className="font-semibold">{formatUsd(tradeInCredit)}</p>
      </div>
      {canSeeFinancials ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-base-300 p-3"><p className="text-xs text-base-content/50">Costo total</p><p className="font-semibold">{formatUsd(costTotal)}</p></div>
          <div className="rounded-lg border border-base-300 p-3"><p className="text-xs text-base-content/50">Ganancia estimada</p><p className="font-semibold">{formatUsd(total - costTotal)}</p></div>
        </div>
      ) : null}
      <label className="form-control max-w-xs">
        <span className="label-text mb-1">Estado</span>
        <select className="select select-bordered" value={status} onChange={(event) => setStatus(event.target.value as SaleStatus)} disabled={!canChangeStatus || isSubmitting}>
          <option value="SENADA">SENADA</option>
          <option value="CONFIRMADA">CONFIRMADA</option>
          <option value="CANCELADA">CANCELADA</option>
        </select>
      </label>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={onConfirm}>Confirmar Venta</button>
        <button type="button" className="btn btn-outline" disabled={isSubmitting} onClick={onReserve}>Registrar Seña / Reservar</button>
      </div>
    </div>
  )
}
