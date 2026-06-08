"use client"

import type { PaymentMethod } from "@prisma/client"
import type { AppointmentDepositFormDraft } from "./useAppointmentForm"

const paymentMethods: PaymentMethod[] = [
  "EFECTIVO_PESOS",
  "EFECTIVO_USD",
  "TRANSFERENCIA_ARS",
  "TRANSFERENCIA_USD",
  "TARJETA",
  "USDT",
]

type AppointmentDepositStepProps = {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  deposits: AppointmentDepositFormDraft[]
  addDeposit: () => void
  updateDeposit: (id: string, patch: Partial<AppointmentDepositFormDraft>) => void
  removeDeposit: (id: string) => void
}

export default function AppointmentDepositStep({
  enabled,
  setEnabled,
  deposits,
  addDeposit,
  updateDeposit,
  removeDeposit,
}: AppointmentDepositStepProps) {
  return (
    <div className="space-y-4">
      <div className="join">
        <button type="button" className={`btn join-item btn-sm ${!enabled ? "btn-primary" : "btn-outline"}`} onClick={() => setEnabled(false)}>
          No
        </button>
        <button
          type="button"
          className={`btn join-item btn-sm ${enabled ? "btn-primary" : "btn-outline"}`}
          onClick={() => {
            setEnabled(true)
            if (deposits.length === 0) addDeposit()
          }}
        >
          Si
        </button>
      </div>

      {!enabled ? <p className="text-sm text-base-content/60">La reserva quedara sin seña registrada por ahora.</p> : null}

      {enabled ? (
        <div className="space-y-3">
          <div className="alert alert-info py-3 text-sm">
            Podes registrar una o mas senas. La seña bloquea la reserva y ayuda a priorizar el seguimiento.
          </div>

          {deposits.map((deposit) => (
            <div key={deposit.id} className="grid grid-cols-1 gap-3 rounded-lg border border-base-300 p-3 md:grid-cols-5">
              <label className="form-control">
                <span className="label-text mb-1">Importe</span>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={deposit.amount}
                  min={0}
                  onChange={(event) => updateDeposit(deposit.id, { amount: parseFloat(event.target.value) || 0 })}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Metodo</span>
                <select
                  className="select select-bordered select-sm"
                  value={deposit.method}
                  onChange={(event) => updateDeposit(deposit.id, { method: event.target.value as PaymentMethod })}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Moneda</span>
                <select
                  className="select select-bordered select-sm"
                  value={deposit.currency}
                  onChange={(event) => updateDeposit(deposit.id, { currency: event.target.value as AppointmentDepositFormDraft["currency"] })}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                </select>
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1">Notas</span>
                <input
                  className="input input-bordered input-sm"
                  value={deposit.notes}
                  onChange={(event) => updateDeposit(deposit.id, { notes: event.target.value })}
                />
              </label>
              <div className="md:col-span-5">
                <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeDeposit(deposit.id)}>
                  Quitar pago
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-sm" onClick={addDeposit}>
            Anadir otro pago
          </button>
          <p className="text-xs text-base-content/50">Las señas se guardan como datos estructurados de la reserva y se usan en resumen, exportacion y cashout.</p>
        </div>
      ) : null}
    </div>
  )
}
