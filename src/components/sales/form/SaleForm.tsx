"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import SaleBuyerStep from "./SaleBuyerStep"
import SaleFormStepper from "./SaleFormStepper"
import SaleItemsStep from "./SaleItemsStep"
import SaleMetaStep from "./SaleMetaStep"
import SalePaymentsStep from "./SalePaymentsStep"
import SaleReservationStep from "./SaleReservationStep"
import SaleStepCard from "./SaleStepCard"
import SaleStickySummary from "./SaleStickySummary"
import SaleSuccessScreen from "./SaleSuccessScreen"
import SaleSummaryStep from "./SaleSummaryStep"
import SaleTradeInStep from "./SaleTradeInStep"
import { useSaleForm } from "./useSaleForm"
import type { SaleFormInitialData } from "@/components/sales/types"

export default function SaleForm({
  mode,
  initialData,
  initialAppointmentId,
}: {
  mode: "create" | "edit"
  initialData?: SaleFormInitialData
  initialAppointmentId?: string | null
}) {
  const form = useSaleForm({ mode, initialData, initialAppointmentId })

  if (form.success) return <SaleSuccessScreen success={form.success} />

  const steps: { key: string; title: string; summary: string; node: ReactNode }[] = []

  if (form.planCanjeEnabled) {
    steps.push({
      key: "trade-in",
      title: "Plan Canje",
      summary: `${form.tradeInDevices.length} equipos / USD ${form.totals.tradeInCredit.toFixed(2)}`,
      node: (
        <SaleTradeInStep
          config={form.tradeInConfig}
          loading={form.configLoading}
          isAdmin={form.isAdmin}
          devices={form.tradeInDevices}
          editingDevice={form.editingTradeInDevice}
          onEdit={form.setEditingTradeInDevice}
          onCancelEdit={() => form.setEditingTradeInDevice(null)}
          onSubmit={form.addTradeInDevice}
          onRemove={form.removeTradeInDevice}
          total={form.totals.tradeInCredit}
        />
      ),
    })
  }

  if (form.operationFlow === "RESERVATION") {
    steps.push({
      key: "reservation",
      title: "Seleccionar reserva",
      summary: form.selectedAppointmentId ? `Reserva ${form.selectedAppointmentId.slice(-4)}` : "Reserva pendiente",
      node: (
        <SaleReservationStep
          selectedAppointmentId={form.selectedAppointmentId}
          setSelectedAppointmentId={form.setSelectedAppointmentId}
          setBuyer={form.setSelectedBuyer}
          setItems={form.setItems}
        />
      ),
    })
  } else {
    steps.push({
      key: "buyer",
      title: "Cliente",
      summary: form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "Consumidor Final",
      node: (
        <SaleBuyerStep
          buyer={form.selectedBuyer}
          setBuyer={form.setSelectedBuyer}
          customerKind={form.customerKind}
          setCustomerKind={form.setCustomerKind}
          disabled={form.saleIsLocked}
        />
      ),
    })
    steps.push({
      key: "meta",
      title: "Venta",
      summary: form.meta.origin,
      node: <SaleMetaStep meta={form.meta} setMeta={form.setMeta} disabled={form.saleIsLocked} />,
    })
  }

  steps.push(
    {
      key: "items",
      title: "Items",
      summary: `${form.items.length} items`,
      node: <SaleItemsStep items={form.items} setItems={form.setItems} disabled={form.saleIsLocked} />,
    },
    {
      key: "payments",
      title: "Pago",
      summary: `Restante USD ${form.totals.remaining.toFixed(2)}`,
      node: (
        <SalePaymentsStep
          payments={form.payments}
          setPayments={form.setPayments}
          total={form.totals.total}
          remaining={form.totals.remaining}
          disabled={form.saleIsLocked}
        />
      ),
    },
    {
      key: "summary",
      title: "Resumen",
      summary: `Total USD ${form.totals.total.toFixed(2)}`,
      node: (
        <SaleSummaryStep
          items={form.items}
          payments={form.payments}
          total={form.totals.total}
          paid={form.totals.totalPaid}
          remaining={form.totals.remaining}
          tradeInCredit={form.totals.tradeInCredit}
          canSeeFinancials={form.canSeeFinancials}
          status={form.saleStatus}
          setStatus={form.setSaleStatus}
          canChangeStatus={form.canChangeStatus}
          error={form.error}
          isSubmitting={form.isSubmitting || form.isReserving}
          onConfirm={() => form.submit("CONFIRM_SALE")}
          onReserve={() => form.submit("RESERVE")}
        />
      ),
    },
  )

  const stepperSteps = steps.map((step) => ({ label: step.title, summary: step.summary }))

  return (
    <div className="space-y-4 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mode === "create" ? "Nueva venta" : "Editar venta"}</h1>
          <p className="mt-1 text-sm text-base-content/60">Flujo guiado para ventas directas, reservas y Plan Canje.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Plan Canje */}
          <span className="text-sm text-base-content/80">Plan Canje</span>
          <div className="join">
            <button type="button" className={`btn btn-sm join-item ${form.planCanjeEnabled ? "btn-outline" : "btn-primary"}`} onClick={() => form.setPlanCanjeEnabled(false)} disabled={form.saleIsLocked}>
              No
            </button>
            <button type="button" className={`btn btn-sm join-item ${form.planCanjeEnabled ? "btn-primary" : "btn-outline"}`} onClick={() => form.setPlanCanjeEnabled(true)} disabled={form.saleIsLocked}>
              Si
            </button>
          </div>
          <div className="join">
            <button type="button" className={`btn btn-sm join-item ${form.operationFlow === "DIRECT" ? "btn-primary" : "btn-outline"}`} onClick={() => form.setOperationFlow("DIRECT")} disabled={form.saleIsLocked || mode === "edit"}>
              Directa
            </button>
            <button type="button" className={`btn btn-sm join-item ${form.operationFlow === "RESERVATION" ? "btn-primary" : "btn-outline"}`} onClick={() => form.setOperationFlow("RESERVATION")} disabled={form.saleIsLocked || mode === "edit"}>
              Reserva
            </button>
          </div>
          <Link href="/dashboard/sales" className="btn btn-ghost btn-sm">Volver</Link>
        </div>
      </div>

      {form.saleIsLocked ? (
        <div className="alert alert-warning py-3 text-sm">Esta venta confirmada solo puede modificarse con rol ADMIN.</div>
      ) : null}

      <SaleFormStepper steps={stepperSteps} activeStep={form.activeStep} onStepChange={form.setActiveStep} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <SaleStepCard key={step.key} index={index} title={step.title} summary={step.summary} activeStep={form.activeStep} onStepChange={form.setActiveStep}>
              {step.node}
            </SaleStepCard>
          ))}
        </div>
        <SaleStickySummary
          buyer={form.selectedBuyer}
          items={form.items}
          total={form.totals.total}
          paid={form.totals.totalPaid}
          remaining={form.totals.remaining}
          tradeInCredit={form.totals.tradeInCredit}
          isSubmitting={form.isSubmitting || form.isReserving}
          onConfirm={() => form.submit("CONFIRM_SALE")}
          onReserve={() => form.submit("RESERVE")}
        />
      </div>
    </div>
  )
}
