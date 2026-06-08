"use client"

import type { Buyer } from "@prisma/client"
import { formatMoney } from "@/components/appointments/appointmentUtils"
import type { AppointmentInterestDraft } from "@/components/appointments/AppointmentInterestSection"

type AppointmentStickySummaryProps = {
  selectedBuyer: Buyer | null
  items: AppointmentInterestDraft[]
  agreedTotal: number
  depositTotal: number
  tradeInCredit: number
  balance: number
  isSubmitting: boolean
  onSubmit: () => void
}

export default function AppointmentStickySummary({
  selectedBuyer,
  items,
  agreedTotal,
  depositTotal,
  tradeInCredit,
  balance,
  isSubmitting,
  onSubmit,
}: AppointmentStickySummaryProps) {
  return (
    <aside className="sticky top-4 rounded-lg border border-base-300 bg-base-100 p-4">
      <h2 className="font-semibold">Resumen</h2>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="text-base-content/50">Cliente</p>
          <p className="font-medium">{selectedBuyer ? `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim() : "Pendiente"}</p>
        </div>
        <div>
          <p className="text-base-content/50">Items</p>
          <p className="font-medium">{items.length}</p>
        </div>
        <div className="divide-y divide-base-300 rounded-lg border border-base-300">
          <p className="flex justify-between p-2">
            <span>Total</span>
            <span>{formatMoney(agreedTotal)}</span>
          </p>
          <p className="flex justify-between p-2">
            <span>Senas</span>
            <span>{formatMoney(depositTotal)}</span>
          </p>
          <p className="flex justify-between p-2">
            <span>Plan Canje</span>
            <span>{formatMoney(tradeInCredit)}</span>
          </p>
          <p className="flex justify-between p-2 font-semibold">
            <span>Saldo</span>
            <span>{formatMoney(balance)}</span>
          </p>
        </div>
      </div>
      <button type="button" className="btn btn-primary mt-4 w-full" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Confirmar"}
      </button>
    </aside>
  )
}
