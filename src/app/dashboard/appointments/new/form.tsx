"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import AppointmentDepositStep from "@/components/appointments/form/AppointmentDepositStep"
import AppointmentFormStepper from "@/components/appointments/form/AppointmentFormStepper"
import AppointmentItemsStep from "@/components/appointments/form/AppointmentItemsStep"
import AppointmentNotesStep from "@/components/appointments/form/AppointmentNotesStep"
import AppointmentOperationStep from "@/components/appointments/form/AppointmentOperationStep"
import AppointmentStepCard from "@/components/appointments/form/AppointmentStepCard"
import AppointmentStickySummary from "@/components/appointments/form/AppointmentStickySummary"
import AppointmentSummaryStep from "@/components/appointments/form/AppointmentSummaryStep"
import AppointmentTradeInStep from "@/components/appointments/form/AppointmentTradeInStep"
import { useAppointmentForm } from "@/components/appointments/form/useAppointmentForm"

export default function NewAppointmentForm() {
  const form = useAppointmentForm("create")

  if (form.success) {
    return (
      <DashboardLayout>
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Reservas / Citas", href: "/dashboard/appointments" },
            { label: "Reserva creada" },
          ]}
        />
        <div className="mx-auto max-w-2xl rounded-lg border border-base-300 bg-base-100 p-8 text-center">
          <h1 className="text-2xl font-bold">Reunion registrada con exito</h1>
          <p className="mt-2 text-base-content/70">
            Programada para {form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "el cliente seleccionado"}.
          </p>
          <p className="mt-1 text-sm text-base-content/60">Sena de {form.depositTotal} registrada como dato local del flujo.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/dashboard/appointments" className="btn btn-primary">
              Ver citas
            </Link>
            <button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>
              Nueva cita
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const steps: { key: string; title: string; summary: string; node: ReactNode }[] = []

  if (form.planCanjeEnabled) {
    steps.push({
      key: "trade-in",
      title: "Plan Canje",
      summary: `${form.tradeInDevices.length} equipos / USD ${form.tradeInCredit.toFixed(2)}`,
      node: (
        <AppointmentTradeInStep
          config={form.tradeInConfig}
          loading={form.configLoading}
          isAdmin={form.isAdmin}
          devices={form.tradeInDevices}
          editingDevice={form.editingTradeInDevice}
          onEdit={form.setEditingTradeInDevice}
          onCancelEdit={() => form.setEditingTradeInDevice(null)}
          onSubmit={form.addTradeInDevice}
          onRemove={form.removeTradeInDevice}
          total={form.tradeInCredit}
        />
      ),
    })
  }

  steps.push(
    {
      key: "operation",
      title: "Operacion",
      summary: form.selectedBuyer?.name ?? "Cliente y fecha",
      node: (
        <AppointmentOperationStep
          selectedBuyer={form.selectedBuyer}
          setSelectedBuyer={form.setSelectedBuyer}
          customerKind={form.customerKind}
          setCustomerKind={form.setCustomerKind}
          wholesaleNotes={form.wholesaleNotes}
          setWholesaleNotes={form.setWholesaleNotes}
          scheduledAt={form.scheduledAt}
          setScheduledAt={form.setScheduledAt}
          durationMinutes={form.durationMinutes}
          setDurationMinutes={form.setDurationMinutes}
        />
      ),
    },
    {
      key: "items",
      title: "Items",
      summary: `${form.items.length} items seleccionados`,
      node: <AppointmentItemsStep items={form.items} setItems={form.setItems} />,
    },
    {
      key: "deposit",
      title: "Sena",
      summary: form.depositEnabled ? `${form.deposits.length} pagos cargados` : "Sin sena",
      node: (
        <AppointmentDepositStep
          enabled={form.depositEnabled}
          setEnabled={form.setDepositEnabled}
          deposits={form.deposits}
          addDeposit={form.addDeposit}
          updateDeposit={form.updateDeposit}
          removeDeposit={form.removeDeposit}
        />
      ),
    },
    {
      key: "notes",
      title: "Notas",
      summary: form.notes ? "Notas cargadas" : "Sin notas",
      node: <AppointmentNotesStep notes={form.notes} setNotes={form.setNotes} />,
    },
    {
      key: "summary",
      title: "Resumen",
      summary: "Confirmacion final",
      node: (
        <AppointmentSummaryStep
          mode="create"
          selectedBuyer={form.selectedBuyer}
          scheduledAt={form.scheduledAt}
          durationMinutes={form.durationMinutes}
          items={form.items}
          agreedTotal={form.agreedTotal}
          depositTotal={form.depositTotal}
          tradeInCredit={form.tradeInCredit}
          balance={form.balance}
          notes={form.notes}
          status={form.status}
          setStatus={form.setStatus}
          outcome={form.outcome}
          setOutcome={form.setOutcome}
          noSaleReason={form.noSaleReason}
          setNoSaleReason={form.setNoSaleReason}
          noSaleReasonOther={form.noSaleReasonOther}
          setNoSaleReasonOther={form.setNoSaleReasonOther}
          error={form.error}
          isSubmitting={form.isSubmitting}
          onSubmit={form.requestSubmit}
        />
      ),
    },
  )

  const stepLabels = steps.map((step) => step.title)

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Reservas / Citas", href: "/dashboard/appointments" },
          { label: "Crear Cita" },
        ]}
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Crear Cita</h1>
            <p className="mt-1 text-sm text-base-content/60">Gestiona cliente, items, sena, Plan Canje y seguimiento comercial.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-base-content/80">Plan Canje</span>
            <div className="join">
              <button type="button" className={`btn btn-sm join-item ${form.planCanjeEnabled ? "btn-outline" : "btn-primary"}`} onClick={() => form.setPlanCanjeEnabled(false)}>
                No
              </button>
              <button type="button" className={`btn btn-sm join-item ${form.planCanjeEnabled ? "btn-primary" : "btn-outline"}`} onClick={() => form.setPlanCanjeEnabled(true)}>
                Si
              </button>
            </div>
          </div>
        </div>

        <AppointmentFormStepper steps={stepLabels} activeStep={form.activeStep} onStepChange={form.setActiveStep} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <AppointmentStepCard key={step.key} index={index} title={step.title} summary={step.summary} activeStep={form.activeStep} onStepChange={form.setActiveStep}>
                {step.node}
              </AppointmentStepCard>
            ))}
          </div>

          <AppointmentStickySummary
            selectedBuyer={form.selectedBuyer}
            items={form.items}
            agreedTotal={form.agreedTotal}
            depositTotal={form.depositTotal}
            tradeInCredit={form.tradeInCredit}
            balance={form.balance}
            isSubmitting={form.isSubmitting}
            onSubmit={form.requestSubmit}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
