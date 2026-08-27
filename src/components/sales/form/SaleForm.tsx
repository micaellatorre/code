"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useEffect } from "react"
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
import { DialogSummaryActions } from "@/components/ui/dialog"
import { formatUsd } from "@/components/sales/salesUtils"
import type { SaleFormInitialData, SaleFormSuccess } from "@/components/sales/types"

export default function SaleForm({
  mode,
  initialData,
  initialAppointmentId,
  presentation = "page",
  onSuccess,
  onCancel,
  onSubmittingChange,
}: {
  mode: "create" | "edit"
  initialData?: SaleFormInitialData
  initialAppointmentId?: string | null
  presentation?: "page" | "dialog"
  onSuccess?: (success: SaleFormSuccess) => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const form = useSaleForm({ mode, initialData, initialAppointmentId, onSuccess })
  const busy = form.isSubmitting || form.isReserving
  const isDialog = presentation === "dialog"

  useEffect(() => {
    onSubmittingChange?.(busy)
  }, [busy, onSubmittingChange])

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
      node: (
        <SaleMetaStep
          meta={form.meta}
          setMeta={form.setMeta}
          disabled={form.saleIsLocked}
          isAdmin={form.isAdmin}
          branches={form.branches}
          selectedBranchId={form.selectedBranchId}
          setSelectedBranchId={form.setSelectedBranchId}
        />
      ),
    })
  }

  steps.push(
    {
      key: "items",
      title: "Items",
      summary: `${form.items.length} items`,
      node: (
        <SaleItemsStep
          items={form.items}
          setItems={form.setItems}
          disabled={form.saleIsLocked}
          branchId={form.selectedBranchId}
          saleType={form.customerKind === "wholesale" ? "MAYORISTA" : "MINORISTA"}
        />
      ),
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
          isSubmitting={busy}
          onConfirm={() => form.submit("CONFIRM_SALE")}
          onReserve={() => form.submit("RESERVE")}
        />
      ),
    },
  )

  const stepperSteps = steps.map((step) => ({ label: step.title, summary: step.summary }))
  const summaryContent = (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-base-content/50">Cliente</p>
          <p className="font-medium">{form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "Consumidor Final"}</p>
        </div>
        <div>
          <p className="text-base-content/50">Items</p>
          <p className="font-medium">{form.items.length}</p>
          {form.items.some((item) => item.parentClientLineId) ? (
            <p className="text-xs text-primary">{form.items.filter((item) => item.parentClientLineId).length} accesorios asociados</p>
          ) : null}
        </div>
      </div>
      <div className="divide-y divide-base-300 rounded-lg border border-base-300">
        <p className="flex justify-between p-2"><span>Total</span><span>{formatUsd(form.totals.total)}</span></p>
        <p className="flex justify-between p-2"><span>Plan Canje</span><span>{formatUsd(form.totals.tradeInCredit)}</span></p>
        <p className="flex justify-between p-2"><span>Pagado</span><span>{formatUsd(form.totals.totalPaid)}</span></p>
        <p className="flex justify-between p-2 font-semibold"><span>Restante</span><span>{formatUsd(form.totals.remaining)}</span></p>
      </div>
      {form.error ? <div className="alert alert-error text-sm">{form.error}</div> : null}
    </div>
  )

  return (
    <div className={`space-y-4 ${isDialog ? "pb-28 sm:pb-28" : "sm:p-4"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {!isDialog ? <div>
          <h1 className="text-2xl font-bold">{mode === "create" ? "Nueva venta" : "Editar venta"}</h1>
          <p className="mt-1 text-sm text-base-content/60">Flujo guiado para ventas directas, reservas y Plan Canje.</p>
        </div> : null}
        <div className={`flex flex-wrap gap-2 items-center ${isDialog ? "w-full justify-end" : ""}`}>
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
          {onCancel && !isDialog ? (
            <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={busy}>
              Volver
            </button>
          ) : !onCancel ? (
            <Link href="/dashboard/sales" className="btn btn-ghost btn-sm">Volver</Link>
          ) : null}
        </div>
      </div>

      {form.saleIsLocked ? (
        <div className="alert alert-warning py-3 text-sm">Esta venta confirmada solo puede modificarse con rol ADMIN.</div>
      ) : null}

      <SaleFormStepper steps={stepperSteps} activeStep={form.activeStep} onStepChange={form.setActiveStep} />

      <div className={`grid grid-cols-1 gap-4 ${isDialog ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <SaleStepCard key={step.key} index={index} title={step.title} summary={step.summary} activeStep={form.activeStep} onStepChange={form.setActiveStep}>
              {step.node}
            </SaleStepCard>
          ))}
        </div>
        {!isDialog ? <SaleStickySummary
          buyer={form.selectedBuyer}
          items={form.items}
          total={form.totals.total}
          paid={form.totals.totalPaid}
          remaining={form.totals.remaining}
          tradeInCredit={form.totals.tradeInCredit}
          isSubmitting={busy}
          onConfirm={() => form.submit("CONFIRM_SALE")}
          onReserve={() => form.submit("RESERVE")}
        /> : null}
      </div>

      {isDialog ? (
        <DialogSummaryActions
          layout="drawer"
          title="Resumen"
          mobileLabel={form.selectedBuyer ? `${form.selectedBuyer.name} ${form.selectedBuyer.surname ?? ""}`.trim() : "Consumidor Final"}
          mobileValue={formatUsd(form.totals.remaining)}
          summary={summaryContent}
          actions={({ compact }) => (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => form.submit("CONFIRM_SALE")}>
                {busy ? <span className="loading loading-spinner loading-xs" /> : null}
                {compact ? "Confirmar" : "Confirmar venta"}
              </button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => form.submit("RESERVE")}>
                {compact ? "Seña" : "Registrar seña / reservar"}
              </button>
              {onCancel ? (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
                  Volver
                </button>
              ) : null}
            </>
          )}
        />
      ) : null}
    </div>
  )
}
