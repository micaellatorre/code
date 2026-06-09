"use client"

import Link from "next/link"
import { CreditCardIcon, PencilIcon, ShoppingCartIcon, TrashIcon } from "@heroicons/react/24/outline"
import type { AppointmentOutcome } from "@prisma/client"
import {
  formatAppointmentDate,
  formatMoney,
  formatRelativeAppointmentTime,
  getAppointmentReservedValue,
  isTodayInArgentina,
} from "./appointmentUtils"
import AppointmentBuyerCell from "./AppointmentBuyerCell"
import AppointmentCreatedByEditor from "./AppointmentCreatedByEditor"
import AppointmentItemsCell from "./AppointmentItemsCell"
import AppointmentOutcomeEditor from "./AppointmentOutcomeEditor"
import AppointmentStatusBadge from "./AppointmentStatusBadge"
import type { SerializedAppointment, UserSearchResult } from "./types"

type AppointmentTableRowProps = {
  appointment: SerializedAppointment
  isAdmin: boolean
  isEditingOutcome: boolean
  isSavingOutcome: boolean
  onEditOutcome: () => void
  onCancelOutcome: () => void
  onUpdateOutcome: (outcome: AppointmentOutcome) => void
  onDelete: () => void
  onCashout: () => void
  createdByProps: {
    isEditing: boolean
    isSearchingUsers: boolean
    isSavingCreatedBy: boolean
    userSearchQuery: string
    userSearchResults: UserSearchResult[]
    editorRef: React.RefObject<HTMLDivElement>
    onOpen: () => void
    onClose: () => void
    onUserSearchQueryChange: (value: string) => void
    onSelectUser: (user: UserSearchResult) => void
  }
}

export default function AppointmentTableRow({
  appointment,
  isAdmin,
  isEditingOutcome,
  isSavingOutcome,
  onEditOutcome,
  onCancelOutcome,
  onUpdateOutcome,
  onDelete,
  onCashout,
  createdByProps,
}: AppointmentTableRowProps) {
  const reservedValue = getAppointmentReservedValue(appointment)

  return (
    <tr className="hover">
      <td className="align-top">
        <div className="min-w-32">
          <p className="font-medium">{formatAppointmentDate(appointment.scheduledAt)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {appointment.durationMinutes ? (
              <span className="badge badge-outline badge-xs">{appointment.durationMinutes} min</span>
            ) : null}
            {isTodayInArgentina(appointment.scheduledAt) ? <span className="badge badge-info badge-xs">Hoy</span> : null}
          </div>
        </div>
      </td>
      <td className="align-top">
        <AppointmentItemsCell interests={appointment.interests} />
      </td>
      <td className="align-top">
        <AppointmentBuyerCell buyer={appointment.buyer} />
        <div className="mt-2 text-xs text-base-content/50">
          Creada por:{" "}
          <AppointmentCreatedByEditor appointment={appointment} isAdmin={isAdmin} {...createdByProps} />
        </div>
      </td>
      <td className="align-top text-lg font-medium">{formatMoney(reservedValue)}</td>
      <td className="align-top">
        <span className="badge badge-ghost gap-1 text-nowrap">
          <CreditCardIcon className="size-3" />
          Sin seña
        </span>
      </td>
      <td className="align-top">
        <p className="min-w-32 text-sm">{formatRelativeAppointmentTime(appointment.scheduledAt)}</p>
        <p className="text-xs text-base-content/50">{formatAppointmentDate(appointment.scheduledAt, "dd/MM/yyyy")}</p>
      </td>
      <td className="align-top">
        <AppointmentStatusBadge status={appointment.status} />
      </td>
      <td className="align-top">
        <AppointmentOutcomeEditor
          appointment={appointment}
          isEditing={isEditingOutcome}
          isSaving={isSavingOutcome}
          onEdit={onEditOutcome}
          onCancel={onCancelOutcome}
          onChange={onUpdateOutcome}
        />
      </td>
      <td className="align-top">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/appointments/${appointment.id}/edit`}
            className="btn btn-square btn-ghost btn-xs"
            title="Editar"
          >
            <PencilIcon className="size-4" />
          </Link>
          <button type="button" onClick={onCashout} className="btn btn-square btn-ghost btn-xs" title="Cashout">
            <ShoppingCartIcon className="size-4" />
          </button>
          <button type="button" onClick={onDelete} className="btn btn-square btn-ghost btn-xs text-error" title="Eliminar">
            <TrashIcon className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
