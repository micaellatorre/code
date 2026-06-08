"use client"

import type { Buyer } from "@prisma/client"
import BuyerSection from "@/components/sales/BuyerSection"
import { fromArgDateTimeInputValue, toArgDateTimeInputValue } from "@/lib/timezone"
import type { CustomerKind } from "./useAppointmentForm"

type AppointmentOperationStepProps = {
  selectedBuyer: Buyer | null
  setSelectedBuyer: (buyer: Buyer | null) => void
  customerKind: CustomerKind
  setCustomerKind: (kind: CustomerKind) => void
  wholesaleNotes: string
  setWholesaleNotes: (value: string) => void
  scheduledAt: Date
  setScheduledAt: (date: Date) => void
  durationMinutes: number
  setDurationMinutes: (minutes: number) => void
}

export default function AppointmentOperationStep({
  selectedBuyer,
  setSelectedBuyer,
  customerKind,
  setCustomerKind,
  wholesaleNotes,
  setWholesaleNotes,
  scheduledAt,
  setScheduledAt,
  durationMinutes,
  setDurationMinutes,
}: AppointmentOperationStepProps) {
  return (
    <div className="space-y-4">
      <div className="join">
        <button
          type="button"
          className={`btn join-item btn-sm ${customerKind === "retail" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setCustomerKind("retail")}
        >
          Minorista
        </button>
        <button
          type="button"
          className={`btn join-item btn-sm ${customerKind === "wholesale" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setCustomerKind("wholesale")}
        >
          Mayorista
        </button>
      </div>

      <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} />

      {customerKind === "wholesale" ? (
        <label className="form-control">
          <span className="label-text mb-1">Datos mayorista / envio</span>
          <textarea
            className="textarea textarea-bordered min-h-28"
            value={wholesaleNotes}
            onChange={(event) => setWholesaleNotes(event.target.value)}
            placeholder="DNI/CUIT, direccion, localidad, provincia, CP, transporte preferido, dias y horarios de contacto."
          />
          <span className="mt-1 text-xs text-base-content/50">Estos datos se guardan en las notas estructuradas de la reserva.</span>
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="form-control">
          <span className="label-text mb-1">Fecha y hora de reunion</span>
          <input
            type="datetime-local"
            value={toArgDateTimeInputValue(scheduledAt)}
            onChange={(event) => setScheduledAt(fromArgDateTimeInputValue(event.target.value))}
            className="input input-bordered"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Duracion en minutos</span>
          <input
            type="number"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(parseInt(event.target.value) || 0)}
            className="input input-bordered"
            min={1}
          />
        </label>
      </div>
    </div>
  )
}
