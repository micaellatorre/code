"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AppointmentStatus } from "@prisma/client"
import { STATUS_OPTIONS } from "./appointmentUtils"
import type { SerializedAppointment } from "./types"

type BulkAction = "status" | "delete"

type BulkAppointmentsDialogProps = {
  open: boolean
  appointments: SerializedAppointment[]
  loading: boolean
  onClose: () => void
  onUpdateStatus: (status: AppointmentStatus) => Promise<void>
  onDelete: () => Promise<void>
}

export default function BulkAppointmentsDialog({
  open,
  appointments,
  loading,
  onClose,
  onUpdateStatus,
  onDelete,
}: BulkAppointmentsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [action, setAction] = useState<BulkAction>("status")
  const [status, setStatus] = useState<AppointmentStatus>("PROGRAMADA")

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.filter((item) => appointments.some((appointment) => appointment.status !== item)),
    [appointments],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    setAction("status")
    setStatus(statusOptions[0] ?? "PROGRAMADA")
  }, [open, statusOptions])

  async function handleConfirm() {
    if (action === "delete") {
      await onDelete()
      return
    }

    await onUpdateStatus(status)
  }

  const confirmLabel = action === "delete" ? "Eliminar lote" : "Actualizar lote"

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={(event) => {
        if (loading) {
          event.preventDefault()
          return
        }
        onClose()
      }}
    >
      <div className="modal-box max-w-xl rounded-lg">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Modificar lote</h2>
            <p className="mt-2 text-sm leading-6 text-base-content/70">
              Se aplicara la accion a {appointments.length} cita{appointments.length === 1 ? "" : "s"} seleccionada
              {appointments.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`rounded-lg border p-3 ${action === "status" ? "border-primary bg-primary/5" : "border-base-300"}`}>
              <input
                type="radio"
                name="bulk-appointment-action"
                className="radio radio-primary radio-sm"
                checked={action === "status"}
                disabled={loading}
                onChange={() => setAction("status")}
              />
              <span className="ml-2 text-sm font-medium">Cambiar estado</span>
            </label>
            <label className={`rounded-lg border p-3 ${action === "delete" ? "border-error bg-error/5" : "border-base-300"}`}>
              <input
                type="radio"
                name="bulk-appointment-action"
                className="radio radio-error radio-sm"
                checked={action === "delete"}
                disabled={loading}
                onChange={() => setAction("delete")}
              />
              <span className="ml-2 text-sm font-medium">Eliminar citas</span>
            </label>
          </div>

          {action === "status" ? (
            <label className="form-control">
              <span className="label">
                <span className="label-text">Nuevo estado</span>
              </span>
              <select
                className="select select-bordered"
                value={status}
                disabled={loading}
                onChange={(event) => setStatus(event.target.value as AppointmentStatus)}
              >
                {(statusOptions.length ? statusOptions : STATUS_OPTIONS).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="alert alert-warning py-3 text-sm">
              Las citas eliminadas dejaran de estar disponibles para seguimiento operativo.
            </div>
          )}
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
          <button
            type="button"
            className={`btn ${action === "delete" ? "btn-error" : "btn-primary"}`}
            onClick={handleConfirm}
            disabled={loading || appointments.length === 0}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            {loading ? "Aplicando..." : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
