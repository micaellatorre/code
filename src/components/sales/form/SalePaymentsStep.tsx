"use client"

import PaymentsSection from "@/components/sales/PaymentsSection"
import { formatUsd } from "@/components/sales/salesUtils"
import type { PaymentDraft } from "@/components/sales/types"

export default function SalePaymentsStep({
  payments,
  setPayments,
  total,
  remaining,
  disabled,
}: {
  payments: PaymentDraft[]
  setPayments: (payments: PaymentDraft[]) => void
  total: number
  remaining: number
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="stats border border-base-300 bg-base-100">
        <div className="stat py-3">
          <div className="stat-title">Restante</div>
          <div className="stat-value text-xl">{formatUsd(remaining)}</div>
        </div>
      </div>
      <PaymentsSection payments={payments} setPayments={setPayments} total={total.toFixed(2)} disabled={disabled} />
    </div>
  )
}
