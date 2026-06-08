"use client"

import type { AppointmentOutcome } from "@prisma/client"
import { getOutcomeBadgeClass, OUTCOME_OPTIONS } from "./appointmentUtils"
import type { SerializedAppointment } from "./types"

type AppointmentOutcomeEditorProps = {
  appointment: SerializedAppointment
  isEditing: boolean
  isSaving: boolean
  onEdit: () => void
  onCancel: () => void
  onChange: (outcome: AppointmentOutcome) => void
}

export default function AppointmentOutcomeEditor({
  appointment,
  isEditing,
  isSaving,
  onEdit,
  onCancel,
  onChange,
}: AppointmentOutcomeEditorProps) {
  if (isEditing) {
    return (
      <select
        className="select select-bordered select-xs w-full min-w-40"
        value={appointment.outcome}
        disabled={isSaving}
        autoFocus
        onChange={(event) => onChange(event.target.value as AppointmentOutcome)}
        onBlur={onCancel}
      >
        {OUTCOME_OPTIONS.map((outcome) => (
          <option key={outcome} value={outcome}>
            {outcome}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      type="button"
      className={`badge badge-outline cursor-pointer ${getOutcomeBadgeClass(appointment.outcome)}`}
      onClick={onEdit}
      disabled={isSaving}
    >
      {isSaving ? "Guardando..." : appointment.outcome}
    </button>
  )
}
