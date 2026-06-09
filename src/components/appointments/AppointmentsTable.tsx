"use client"

import type { AppointmentOutcome } from "@prisma/client"
import AppointmentTableRow from "./AppointmentTableRow"
import type { SerializedAppointment, UserSearchResult } from "./types"

type AppointmentsTableProps = {
  appointments: SerializedAppointment[]
  isExpanded: boolean
  isAdmin: boolean
  savingOutcomeId: string | null
  editingOutcomeId: string | null
  setEditingOutcomeId: (id: string | null) => void
  onUpdateOutcome: (appointment: SerializedAppointment, outcome: AppointmentOutcome) => void
  onDelete: (id: string) => void
  onCashout: (appointment: SerializedAppointment) => void
  createdBy: {
    editingCreatedById: string | null
    userSearchQuery: string
    setUserSearchQuery: (value: string) => void
    userSearchResults: UserSearchResult[]
    isSearchingUsers: boolean
    isSavingCreatedBy: boolean
    editorRef: React.RefObject<HTMLDivElement>
    openCreatedByEditor: (appointment: SerializedAppointment) => void
    closeCreatedByEditor: () => void
    handleSelectCreatedBy: (appointmentId: string, user: UserSearchResult) => void
  }
}

export default function AppointmentsTable({
  appointments,
  isExpanded,
  isAdmin,
  savingOutcomeId,
  editingOutcomeId,
  setEditingOutcomeId,
  onUpdateOutcome,
  onDelete,
  onCashout,
  createdBy,
}: AppointmentsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className={`table w-full table-pin-rows ${isExpanded ? "" : "table-sm"}`}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Items</th>
            <th>Cliente</th>
            <th>Precio pactado</th>
            <th>Seña</th>
            <th>Retiro / Entrega</th>
            <th>Estado</th>
            <th>Resultado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <AppointmentTableRow
              key={appointment.id}
              appointment={appointment}
              isAdmin={isAdmin}
              isEditingOutcome={editingOutcomeId === appointment.id}
              isSavingOutcome={savingOutcomeId === appointment.id}
              onEditOutcome={() => setEditingOutcomeId(appointment.id)}
              onCancelOutcome={() => setEditingOutcomeId(null)}
              onUpdateOutcome={(outcome) => {
                onUpdateOutcome(appointment, outcome)
                setEditingOutcomeId(null)
              }}
              onDelete={() => onDelete(appointment.id)}
              onCashout={() => onCashout(appointment)}
              createdByProps={{
                isEditing: createdBy.editingCreatedById === appointment.id,
                isSearchingUsers: createdBy.isSearchingUsers,
                isSavingCreatedBy: createdBy.isSavingCreatedBy,
                userSearchQuery: createdBy.userSearchQuery,
                userSearchResults: createdBy.userSearchResults,
                editorRef: createdBy.editorRef,
                onOpen: () => createdBy.openCreatedByEditor(appointment),
                onClose: createdBy.closeCreatedByEditor,
                onUserSearchQueryChange: createdBy.setUserSearchQuery,
                onSelectUser: (user) => createdBy.handleSelectCreatedBy(appointment.id, user),
              }}
            />
          ))}
          {appointments.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-base-content/60">
                No se encontraron reservas.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
