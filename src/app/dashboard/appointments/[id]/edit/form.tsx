"use client"

import { useEffect, useState } from "react"
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
import { type AppointmentFormInitialData, useAppointmentForm } from "@/components/appointments/form/useAppointmentForm"

interface EditAppointmentFormProps {
  id: string
}

function EditAppointmentFormContent({ initialData }: { initialData: AppointmentFormInitialData }) {
  const form = useAppointmentForm("edit", initialData)

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
      summary: "Estado, resultado y confirmacion",
      node: (
        <AppointmentSummaryStep
          mode="edit"
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

  const stepperSteps = steps.map((step) => ({ label: step.title, summary: step.summary }))

  return (
    <div className="space-y-4 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar reserva</h1>
          <p className="mt-1 text-sm text-base-content/60">Actualiza cliente, fecha, items, resultado, Plan Canje y notas de seguimiento.</p>
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

      <AppointmentFormStepper steps={stepperSteps} activeStep={form.activeStep} onStepChange={form.setActiveStep} />

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
  )
}

export default function EditAppointmentForm({ id }: EditAppointmentFormProps) {
  const [initialData, setInitialData] = useState<AppointmentFormInitialData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function fetchAppointment() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/appointments/${id}`)
        if (!response.ok) throw new Error("No se pudo cargar la reserva.")
        const data = await response.json()
        setInitialData({
          id: data.id,
          scheduledAt: data.scheduledAt,
          durationMinutes: data.durationMinutes,
          status: data.status,
          outcome: data.outcome,
          noSaleReason: data.noSaleReason,
          noSaleReasonOther: data.noSaleReasonOther,
          resultNotes: data.resultNotes,
          buyer: data.buyer,
          interests: (data.interests ?? []).map((interest: any) => ({
            ...interest,
            _id: interest.id,
            agreedPrice: Number(interest.product?.salePrice ?? 0),
            quantity: 1,
            kind: "NORMAL",
          })),
        })
      } catch (fetchError: any) {
        setError(fetchError?.message || "Error de conexion.")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchAppointment()
  }, [id])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <span className="loading loading-lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !initialData) {
    return (
      <DashboardLayout>
        <div className="alert alert-error">{error || "No se pudo cargar la reserva."}</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Reservas / Citas", href: "/dashboard/appointments" },
          { label: "Editar reserva" },
        ]}
      />
      <EditAppointmentFormContent initialData={initialData} />
    </DashboardLayout>
  )
}
