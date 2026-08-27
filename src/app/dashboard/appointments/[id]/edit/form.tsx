"use client"

import { useEffect, useState, type ReactNode } from "react"
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
import { formatMoney } from "@/components/appointments/appointmentUtils"
import { DialogSummaryActions } from "@/components/ui/dialog"

interface EditAppointmentFormProps {
  id: string
  presentation?: "page" | "dialog"
  onSuccess?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}

type AppointmentInterestApi = AppointmentFormInitialData["interests"][number] & {
  id?: string
  product?: { salePrice?: unknown } | null
}

function EditAppointmentFormContent({
  initialData,
  presentation,
  onSuccess,
  onSubmittingChange,
}: {
  initialData: AppointmentFormInitialData
  presentation: "page" | "dialog"
  onSuccess?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const form = useAppointmentForm("edit", initialData, { onSuccess })

  useEffect(() => {
    onSubmittingChange?.(form.isSubmitting)
  }, [form.isSubmitting, onSubmittingChange])

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
  const isDialog = presentation === "dialog"
  const summaryContent = (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-base-content/50">Cliente</p>
          <p className="font-medium">{form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "Pendiente"}</p>
        </div>
        <div>
          <p className="text-base-content/50">Items</p>
          <p className="font-medium">{form.items.length}</p>
        </div>
      </div>
      <div className="divide-y divide-base-300 rounded-lg border border-base-300">
        <p className="flex justify-between p-2"><span>Total</span><span>{formatMoney(form.agreedTotal)}</span></p>
        <p className="flex justify-between p-2"><span>Senas</span><span>{formatMoney(form.depositTotal)}</span></p>
        <p className="flex justify-between p-2"><span>Plan Canje</span><span>{formatMoney(form.tradeInCredit)}</span></p>
        <p className="flex justify-between p-2 font-semibold"><span>Saldo</span><span>{formatMoney(form.balance)}</span></p>
      </div>
      {form.error ? <div className="alert alert-error text-sm">{form.error}</div> : null}
    </div>
  )

  return (
    <div className={`space-y-4 ${isDialog ? "pb-28 sm:pb-28" : "sm:p-4"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {!isDialog ? <div>
          <h1 className="text-2xl font-bold">Editar cita</h1>
          <p className="mt-1 text-sm text-base-content/60">Actualiza cliente, fecha, items, resultado, Plan Canje y notas de seguimiento.</p>
        </div> : null}
        <div className={`flex flex-wrap items-center gap-2 ${isDialog ? "w-full justify-end" : ""}`}>
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

      <div className={`grid grid-cols-1 gap-4 ${isDialog ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <AppointmentStepCard key={step.key} index={index} title={step.title} summary={step.summary} activeStep={form.activeStep} onStepChange={form.setActiveStep}>
              {step.node}
            </AppointmentStepCard>
          ))}
        </div>

        {!isDialog ? <AppointmentStickySummary
          selectedBuyer={form.selectedBuyer}
          items={form.items}
          agreedTotal={form.agreedTotal}
          depositTotal={form.depositTotal}
          tradeInCredit={form.tradeInCredit}
          balance={form.balance}
          isSubmitting={form.isSubmitting}
          onSubmit={form.requestSubmit}
        /> : null}
      </div>
      {isDialog ? (
        <DialogSummaryActions
          layout="drawer"
          title="Resumen"
          mobileLabel={form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "Cita"}
          mobileValue={formatMoney(form.balance)}
          summary={summaryContent}
          actions={({ compact }) => (
            <button type="button" className="btn btn-primary" onClick={form.requestSubmit} disabled={form.isSubmitting}>
              {form.isSubmitting ? (compact ? "..." : "Guardando...") : compact ? "Guardar" : "Guardar cita"}
            </button>
          )}
        />
      ) : null}
    </div>
  )
}

export default function EditAppointmentForm({ id, presentation = "page", onSuccess, onSubmittingChange }: EditAppointmentFormProps) {
  const [initialData, setInitialData] = useState<AppointmentFormInitialData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function fetchAppointment() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/appointments/${id}`)
        if (!response.ok) throw new Error("No se pudo cargar la cita.")
        const data = await response.json()
        const interests = Array.isArray(data.interests) ? data.interests as AppointmentInterestApi[] : []
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
          interests: interests.map((interest) => ({
            ...interest,
            _id: interest.id ?? interest.productId,
            agreedPrice: Number(interest.product?.salePrice ?? 0),
            quantity: 1,
            kind: "NORMAL",
          })),
        })
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Error de conexion.")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchAppointment()
  }, [id])

  useEffect(() => {
    onSubmittingChange?.(isLoading)
  }, [isLoading, onSubmittingChange])

  if (isLoading) {
    const loader = (
      <div className="flex h-full min-h-72 items-center justify-center">
        <span className="loading loading-lg" />
      </div>
    )
    if (presentation === "dialog") return loader
    return <DashboardLayout>{loader}</DashboardLayout>
  }

  if (error || !initialData) {
    const errorContent = <div className="alert alert-error">{error || "No se pudo cargar la cita."}</div>
    if (presentation === "dialog") return errorContent
    return <DashboardLayout>{errorContent}</DashboardLayout>
  }

  const formContent = <EditAppointmentFormContent initialData={initialData} presentation={presentation} onSuccess={onSuccess} onSubmittingChange={onSubmittingChange} />

  if (presentation === "dialog") return formContent

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Citas", href: "/dashboard/appointments" },
          { label: "Editar cita" },
        ]}
      />
      {formContent}
    </DashboardLayout>
  )
}
