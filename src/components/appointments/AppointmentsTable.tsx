"use client"

import type { AppointmentOutcome, AppointmentStatus } from "@prisma/client"
import AppointmentTableRow from "./AppointmentTableRow"
import type { SerializedAppointment, UserSearchResult } from "./types"

type AppointmentsTableProps = {
  appointments: SerializedAppointment[]
  isExpanded: boolean
  isAdmin: boolean
  canManageAppointments: boolean
  selectedAppointmentIds: Set<string>
  savingOutcomeId: string | null
  savingStatusId: string | null
  editingOutcomeId: string | null
  onToggleSelected: (id: string) => void
  onToggleAllVisible: () => void
  setEditingOutcomeId: (id: string | null) => void
  onUpdateOutcome: (appointment: SerializedAppointment, outcome: AppointmentOutcome) => void
  onUpdateStatus: (appointment: SerializedAppointment, status: AppointmentStatus) => void
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
  canManageAppointments,
  selectedAppointmentIds,
  savingOutcomeId,
  savingStatusId,
  editingOutcomeId,
  onToggleSelected,
  onToggleAllVisible,
  setEditingOutcomeId,
  onUpdateOutcome,
  onUpdateStatus,
  onDelete,
  onCashout,
  createdBy,
}: AppointmentsTableProps) {
  const allVisibleSelected = appointments.length > 0 && appointments.every((appointment) => selectedAppointmentIds.has(appointment.id))
  const someVisibleSelected = appointments.some((appointment) => selectedAppointmentIds.has(appointment.id))

  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className={`table w-full table-pin-rows ${isExpanded ? "" : "table-sm"}`}>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={allVisibleSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected
                }}
                onChange={onToggleAllVisible}
                aria-label="Seleccionar citas visibles"
              />
            </th>
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
              canManageAppointments={canManageAppointments}
              isSelected={selectedAppointmentIds.has(appointment.id)}
              isEditingOutcome={editingOutcomeId === appointment.id}
              isSavingOutcome={savingOutcomeId === appointment.id}
              isSavingStatus={savingStatusId === appointment.id}
              onToggleSelected={() => onToggleSelected(appointment.id)}
              onEditOutcome={() => setEditingOutcomeId(appointment.id)}
              onCancelOutcome={() => setEditingOutcomeId(null)}
              onUpdateOutcome={(outcome) => {
                onUpdateOutcome(appointment, outcome)
                setEditingOutcomeId(null)
              }}
              onUpdateStatus={(status) => onUpdateStatus(appointment, status)}
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
              <td colSpan={10} className="py-10 text-center text-base-content/60">
                No se encontraron reservas.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
