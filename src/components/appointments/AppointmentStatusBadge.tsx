"use client"

import type { AppointmentStatus } from "@prisma/client"
import { getStatusBadgeClass, STATUS_OPTIONS } from "./appointmentUtils"

type AppointmentStatusBadgeProps = {
  status: AppointmentStatus
  canEdit?: boolean
  isSaving?: boolean
  onChange?: (status: AppointmentStatus) => void
}

export default function AppointmentStatusBadge({
  status,
  canEdit = false,
  isSaving = false,
  onChange,
}: AppointmentStatusBadgeProps) {
  if (!canEdit) {
    return <span className={`badge badge-outline ${getStatusBadgeClass(status)}`}>{status}</span>
  }

  const options = STATUS_OPTIONS.filter((item) => item !== status)

  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className={`badge cursor-pointer ${getStatusBadgeClass(status)}`}
        disabled={isSaving}
        title="Cambiar estado"
      >
        {isSaving ? "Guardando..." : status}
      </button>
      <ul tabIndex={0} className="menu dropdown-content z-20 mt-2 w-48 rounded-box border border-base-300 bg-base-100 p-2 shadow">
        {options.map((item) => (
          <li key={item}>
            <button type="button" onClick={() => onChange?.(item)} disabled={isSaving}>
              {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
