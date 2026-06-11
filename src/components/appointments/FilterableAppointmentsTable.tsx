"use client"

import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline"
import AppointmentsFilters from "./AppointmentsFilters"
import AppointmentsHeader from "./AppointmentsHeader"
import AppointmentsKpis from "./AppointmentsKpis"
import AppointmentsTable from "./AppointmentsTable"
import AppointmentCashoutModal from "./AppointmentCashoutModal"
import BulkAppointmentsDialog from "./BulkAppointmentsDialog"
import ExportAppointmentsModal from "./ExportAppointmentsModal"
import { useAppointmentsList } from "./useAppointmentsList"
import type { SerializedAppointment } from "./types"

export default function FilterableAppointmentsTable({ initial }: { initial: SerializedAppointment[] }) {
  const list = useAppointmentsList(initial)

  return (
    <div className="space-y-4">
      <AppointmentsHeader
        selectedCalendarDate={list.selectedCalendarDate}
        onSelectedCalendarDateChange={list.setSelectedCalendarDate}
        onExport={() => list.setIsExportModalOpen(true)}
      />

      <AppointmentsKpis kpis={list.kpis} />

      <AppointmentsFilters
        statusSegment={list.statusSegment}
        onStatusSegmentChange={list.setStatusSegment}
        searchQuery={list.searchQuery}
        onSearchQueryChange={list.setSearchQuery}
        dateFrom={list.dateFrom}
        onDateFromChange={list.setDateFrom}
        dateTo={list.dateTo}
        onDateToChange={list.setDateTo}
        total={list.appointments.length}
        filtered={list.filteredAppointments.length}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-base-content/60">
          Resultados <span className="font-semibold text-base-content">{list.filteredAppointments.length}</span> de {list.appointments.length}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          {list.canManageAppointments && list.selectedAppointmentIds.size > 0 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => list.setIsBulkDialogOpen(true)}
            >
              Modificar Lote
              <span className="badge badge-sm">{list.selectedAppointmentIds.size}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => list.setIsTableExpanded(!list.isTableExpanded)}
          >
            {list.isTableExpanded ? "Comprimir" : "Expandir"} tabla
            {list.isTableExpanded ? (
              <ArrowsPointingInIcon className="size-4" />
            ) : (
              <ArrowsPointingOutIcon className="size-4" />
            )}
          </button>
        </div>
      </div>

      <AppointmentsTable
        appointments={list.filteredAppointments}
        isExpanded={list.isTableExpanded}
        isAdmin={list.isAdmin}
        canManageAppointments={list.canManageAppointments}
        selectedAppointmentIds={list.selectedAppointmentIds}
        savingOutcomeId={list.savingOutcomeId}
        savingStatusId={list.savingStatusId}
        editingOutcomeId={list.editingOutcomeId}
        onToggleSelected={list.toggleAppointmentSelection}
        onToggleAllVisible={list.toggleAllVisibleAppointments}
        setEditingOutcomeId={list.setEditingOutcomeId}
        onUpdateOutcome={list.handleUpdateOutcome}
        onUpdateStatus={list.handleUpdateStatus}
        onDelete={list.handleDelete}
        onCashout={list.setCashoutAppointment}
        createdBy={{
          editingCreatedById: list.editingCreatedById,
          userSearchQuery: list.userSearchQuery,
          setUserSearchQuery: list.setUserSearchQuery,
          userSearchResults: list.userSearchResults,
          isSearchingUsers: list.isSearchingUsers,
          isSavingCreatedBy: list.isSavingCreatedBy,
          editorRef: list.editorRef,
          openCreatedByEditor: list.openCreatedByEditor,
          closeCreatedByEditor: list.closeCreatedByEditor,
          handleSelectCreatedBy: list.handleSelectCreatedBy,
        }}
      />

      <ExportAppointmentsModal open={list.isExportModalOpen} onClose={() => list.setIsExportModalOpen(false)} appointments={list.filteredAppointments} />
      <BulkAppointmentsDialog
        open={list.isBulkDialogOpen}
        appointments={list.selectedAppointments}
        loading={list.isBulkSaving}
        onClose={() => list.setIsBulkDialogOpen(false)}
        onUpdateStatus={list.handleBulkUpdateStatus}
        onDelete={list.handleBulkDelete}
      />
      <AppointmentCashoutModal appointment={list.cashoutAppointment} onClose={() => list.setCashoutAppointment(null)} />
    </div>
  )
}
