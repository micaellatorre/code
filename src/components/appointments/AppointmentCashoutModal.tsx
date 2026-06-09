"use client"

import Link from "next/link"
import { formatAppointmentDate, formatMoney, getAppointmentDepositTotal, getAppointmentReservedValue } from "./appointmentUtils"
import type { SerializedAppointment } from "./types"

type AppointmentCashoutModalProps = {
  appointment: SerializedAppointment | null
  onClose: () => void
}

export default function AppointmentCashoutModal({ appointment, onClose }: AppointmentCashoutModalProps) {
  if (!appointment) return null

  const total = getAppointmentReservedValue(appointment)
  const deposit = getAppointmentDepositTotal(appointment)
  const balance = total - deposit

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <h2 className="text-xl font-semibold">Concretar reserva</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Revisa los productos, cliente y saldo antes de continuar a venta.
        </p>

        <div className="mt-4 grid gap-4">
          <div className="rounded-lg border border-base-300 p-3">
            <p className="text-xs font-semibold uppercase text-base-content/50">Cliente</p>
            <p className="mt-1 font-medium">{appointment.buyer?.name ?? "Sin cliente"}</p>
            <p className="text-sm text-base-content/60">{formatAppointmentDate(appointment.scheduledAt)}</p>
          </div>

          <div className="rounded-lg border border-base-300 p-3">
            <p className="text-xs font-semibold uppercase text-base-content/50">Productos</p>
            <div className="mt-2 divide-y divide-base-300">
              {appointment.interests.map((interest) => (
                <Link
                  key={interest.id}
                  href={`/dashboard/products/${interest.productId}/edit`}
                  className="flex items-center justify-between gap-3 py-2 hover:text-primary"
                >
                  <span>{interest.product.modelName}</span>
                  <span>{formatMoney(interest.product.salePrice)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-base-300 p-3">
              <p className="text-xs text-base-content/50">Precio pactado</p>
              <p className="font-semibold">{formatMoney(total)}</p>
            </div>
            <div className="rounded-lg border border-base-300 p-3">
              <p className="text-xs text-base-content/50">Seña</p>
              <p className="font-semibold">{formatMoney(deposit)}</p>
            </div>
            <div className="rounded-lg border border-base-300 p-3">
              <p className="text-xs text-base-content/50">Saldo</p>
              <p className="font-semibold">{formatMoney(balance)}</p>
            </div>
          </div>

          <div className="alert alert-info py-3 text-sm">
            Al continuar se abrira una nueva venta en modo Reserva, con cliente e items precargados desde esta cita.
          </div>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <Link href={`/dashboard/sales/new?appointmentId=${appointment.id}`} className="btn btn-primary">
            Continuar a venta
          </Link>
        </div>
      </div>
    </dialog>
  )
}
