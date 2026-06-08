"use client"

import type { AppointmentNoSaleReason, AppointmentOutcome, AppointmentStatus, Buyer } from "@prisma/client"
import { formatMoney } from "@/components/appointments/appointmentUtils"
import type { AppointmentInterestDraft } from "@/components/appointments/AppointmentInterestSection"

type AppointmentSummaryStepProps = {
  mode: "create" | "edit"
  selectedBuyer: Buyer | null
  scheduledAt: Date
  durationMinutes: number
  items: AppointmentInterestDraft[]
  agreedTotal: number
  depositTotal: number
  tradeInCredit: number
  balance: number
  notes: string
  status: AppointmentStatus
  setStatus: (status: AppointmentStatus) => void
  outcome: AppointmentOutcome
  setOutcome: (outcome: AppointmentOutcome) => void
  noSaleReason: AppointmentNoSaleReason | null
  setNoSaleReason: (reason: AppointmentNoSaleReason | null) => void
  noSaleReasonOther: string
  setNoSaleReasonOther: (value: string) => void
  error: string | null
  isSubmitting: boolean
  onSubmit: () => void
}

const statusOptions: AppointmentStatus[] = ["PROGRAMADA", "CONCRETADA", "CANCELADA", "NO_SE_PRESENTO"]
const outcomeOptions: AppointmentOutcome[] = [
  "PENDIENTE",
  "VENTA_CONCRETADA",
  "NO_SE_CONCRETO",
  "SENADO",
  "SENADO_EN_CAMINO",
  "SENADO_EN_STOCK",
]
const noSaleReasons: AppointmentNoSaleReason[] = [
  "MUY_CARO",
  "MODELO_NO_DISPONIBLE",
  "ENCONTRO_MEJOR_OFERTA",
  "LO_ESTA_PENSANDO",
  "NO_SE_PRESENTO",
  "OTRO",
]

export default function AppointmentSummaryStep({
  mode,
  selectedBuyer,
  scheduledAt,
  durationMinutes,
  items,
  agreedTotal,
  depositTotal,
  tradeInCredit,
  balance,
  notes,
  status,
  setStatus,
  outcome,
  setOutcome,
  noSaleReason,
  setNoSaleReason,
  noSaleReasonOther,
  setNoSaleReasonOther,
  error,
  isSubmitting,
  onSubmit,
}: AppointmentSummaryStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs font-semibold uppercase text-base-content/50">Cliente</p>
          <p className="mt-1 font-medium">
            {selectedBuyer ? `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim() : "Sin cliente"}
          </p>
        </div>
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs font-semibold uppercase text-base-content/50">Fecha / duracion</p>
          <p className="mt-1 font-medium">{scheduledAt.toLocaleString("es-AR")}</p>
          <p className="text-sm text-base-content/60">{durationMinutes} min</p>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1">Estado</span>
            <select className="select select-bordered" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Resultado</span>
            <select className="select select-bordered" value={outcome} onChange={(event) => setOutcome(event.target.value as AppointmentOutcome)}>
              {outcomeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {mode === "edit" && outcome === "NO_SE_CONCRETO" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1">Razon de no venta</span>
            <select
              className="select select-bordered"
              value={noSaleReason ?? ""}
              onChange={(event) => setNoSaleReason(event.target.value as AppointmentNoSaleReason)}
            >
              <option disabled value="">
                Seleccione un motivo
              </option>
              {noSaleReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {noSaleReason === "OTRO" ? (
            <label className="form-control">
              <span className="label-text mb-1">Otro motivo</span>
              <input className="input input-bordered" value={noSaleReasonOther} onChange={(event) => setNoSaleReasonOther(event.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-base-300 p-3">
        <p className="text-xs font-semibold uppercase text-base-content/50">Items seleccionados</p>
        <div className="mt-2 divide-y divide-base-300">
          {items.length ? (
            items.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{item.product.modelName}</span>
                <span className="badge badge-outline">{item.kind ?? "NORMAL"}</span>
              </div>
            ))
          ) : (
            <p className="py-2 text-sm text-base-content/60">Sin items.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs text-base-content/50">Precio acordado</p>
          <p className="font-semibold">{formatMoney(agreedTotal)}</p>
        </div>
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs text-base-content/50">Señas</p>
          <p className="font-semibold">{formatMoney(depositTotal)}</p>
        </div>
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs text-base-content/50">Plan Canje</p>
          <p className="font-semibold">{formatMoney(tradeInCredit)}</p>
        </div>
        <div className="rounded-lg border border-base-300 p-3">
          <p className="text-xs text-base-content/50">Saldo final</p>
          <p className="font-semibold">{formatMoney(balance)}</p>
        </div>
      </div>

      {notes ? <div className="rounded-lg bg-base-200 p-3 text-sm">{notes}</div> : null}
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <button type="button" className="btn btn-primary w-full" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
        {mode === "create" ? "Confirmar reserva" : "Guardar cambios"}
      </button>
    </div>
  )
}
