"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Buyer, SaleStatus } from "@prisma/client"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { Role } from "@/lib/auth/roles"
import type { TradeInConfigDto, TradeInDeviceDraft } from "@/components/trade-in/types"
import type {
  CustomerKind,
  OperationFlow,
  PaymentDraft,
  SaleFormInitialData,
  SaleFormSuccess,
  SaleItemDraft,
  SaleMeta,
  SaleSubmitMode,
} from "@/components/sales/types"

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function paymentId(prefix = "payment") {
  return `${prefix}-${crypto.randomUUID()}`
}

export function useSaleForm({
  mode,
  initialData,
  initialAppointmentId,
}: {
  mode: "create" | "edit"
  initialData?: SaleFormInitialData
  initialAppointmentId?: string | null
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"
  const canSeeFinancials = activeRole === "ADMIN" || activeRole === "SOCIO"

  const [planCanjeEnabled, setPlanCanjeEnabled] = useState(false)
  const [operationFlow, setOperationFlow] = useState<OperationFlow>(initialAppointmentId ? "RESERVATION" : "DIRECT")
  const [customerKind, setCustomerKind] = useState<CustomerKind>("retail")
  const [activeStep, setActiveStep] = useState(0)
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(initialData?.buyer ?? null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(initialAppointmentId ?? null)
  const [meta, setMeta] = useState<SaleMeta>(initialData?.meta ?? { date: new Date(), origin: "Instagram" })
  const [items, setItems] = useState<SaleItemDraft[]>(initialData?.items ?? [])
  const [payments, setPayments] = useState<PaymentDraft[]>(initialData?.payments ?? [])
  const [saleStatus, setSaleStatus] = useState<SaleStatus>(initialData?.status ?? "CONFIRMADA")
  const [tradeInDevices, setTradeInDevices] = useState<TradeInDeviceDraft[]>([])
  const [editingTradeInDevice, setEditingTradeInDevice] = useState<TradeInDeviceDraft | null>(null)
  const [tradeInConfig, setTradeInConfig] = useState<TradeInConfigDto | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReserving, setIsReserving] = useState(false)
  const [success, setSuccess] = useState<SaleFormSuccess | null>(null)

  const saleIsLocked = mode === "edit" && saleStatus === "CONFIRMADA" && activeRole !== "ADMIN"
  const canChangeStatus = activeRole === "ADMIN" || saleStatus === "SENADA"

  const totals = useMemo(() => {
    const subtotal = items
      .filter((item) => item.kind === "NORMAL")
      .reduce((acc, item) => acc + toNumber(item.unitPrice) * item.units, 0)
    const extraCosts = items
      .filter((item) => item.kind === "IN_TOTAL")
      .reduce((acc, item) => acc + (toNumber(item.unitCost) + toNumber(item.extraCost)) * item.units, 0)
    const total = subtotal + extraCosts
    const tradeInCredit = tradeInDevices.reduce((acc, device) => acc + device.finalValue, 0)
    const totalPaid = payments.reduce((acc, payment) => acc + toNumber(payment.amount), 0)

    return {
      subtotal,
      extraCosts,
      total,
      tradeInCredit,
      totalPaid,
      remaining: total - totalPaid,
    }
  }, [items, payments, tradeInDevices])

  useEffect(() => {
    if (!planCanjeEnabled || totals.tradeInCredit <= 0) {
      setPayments((prev) => prev.filter((payment) => payment.method !== "PLAN_CANJE"))
      return
    }

    setPayments((prev) => {
      const withoutTradeIn = prev.filter((payment) => payment.method !== "PLAN_CANJE")
      return [
        ...withoutTradeIn,
        {
          _id: "plan-canje-credit",
          method: "PLAN_CANJE",
          currency: "USD",
          amount: totals.tradeInCredit.toFixed(2),
          note: "Credito Plan Canje",
        },
      ]
    })
  }, [planCanjeEnabled, totals.tradeInCredit])

  useEffect(() => {
    if (!planCanjeEnabled || tradeInConfig) return

    const controller = new AbortController()

    async function loadConfig() {
      setConfigLoading(true)
      try {
        const response = await fetch("/api/trade-in/config", {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(await response.text())
        const config = (await response.json()) as TradeInConfigDto
        setTradeInConfig(config)
      } catch (loadError: any) {
        if (loadError?.name !== "AbortError") {
          console.error("Failed to load trade-in config", loadError)
        }
      } finally {
        if (!controller.signal.aborted) setConfigLoading(false)
      }
    }

    void loadConfig()
    return () => controller.abort()
  }, [planCanjeEnabled, tradeInConfig])

  function addTradeInDevice(device: TradeInDeviceDraft) {
    setTradeInDevices((prev) => {
      const exists = prev.some((item) => item.id === device.id)
      return exists ? prev.map((item) => (item.id === device.id ? device : item)) : [...prev, device]
    })
    setEditingTradeInDevice(null)
  }

  function removeTradeInDevice(id: string) {
    setTradeInDevices((prev) => prev.filter((device) => device.id !== id))
  }

  function validateSubmit(modeToSubmit: SaleSubmitMode) {
    if (saleIsLocked) return "Esta venta confirmada solo puede modificarse con rol ADMIN."
    if (items.length === 0 && saleStatus !== "CANCELADA") return "Debe agregar al menos un producto a la operacion."
    if (modeToSubmit === "CONFIRM_SALE" && Math.abs(totals.remaining) > 0.009) {
      return `El monto de los pagos no coincide con el total. Restan ${totals.remaining.toFixed(2)} USD.`
    }
    if (modeToSubmit === "RESERVE") {
      if (payments.length === 0 || totals.totalPaid <= 0) return "Para senar, debe registrar al menos un pago mayor a 0."
      if (totals.totalPaid > totals.total) return "La sena no puede superar el total de la venta."
    }
    return null
  }

  function buildPayload(modeToSubmit: SaleSubmitMode) {
    return {
      operationType: modeToSubmit,
      appointmentId: selectedAppointmentId,
      operationFlow,
      tradeInDevices,
      date: meta.date.toISOString(),
      buyerId: selectedBuyer?.id,
      customerName: !selectedBuyer ? "Consumidor Final" : null,
      origin: operationFlow === "RESERVATION" ? "Reserva" : meta.origin === "Otro" ? meta.customOrigin : meta.origin,
      notes: meta.notes,
      status: saleStatus,
      items: items.map((item) => ({
        productId: item.productId,
        units: item.units,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        extraCost: item.extraCost,
        kind: item.kind,
      })),
      payments: payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency,
        amount: payment.amount,
        note: payment.note,
        paidAt: payment.paidAt?.toISOString(),
        exchangeRate: payment.exchangeRate,
      })),
    }
  }

  async function submit(modeToSubmit: SaleSubmitMode) {
    const validation = validateSubmit(modeToSubmit)
    if (validation) {
      setError(validation)
      return
    }

    await confirmDialog.confirmAction({
      variant: "success",
      title: modeToSubmit === "CONFIRM_SALE" ? "Confirmar venta" : "Registrar sena / reservar",
      description: "Se registrara la operacion, se guardaran los pagos y se actualizara el stock correspondiente.",
      details: [
        { label: "Cliente", value: selectedBuyer ? `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim() : "Consumidor Final" },
        { label: "Items", value: String(items.length) },
        { label: "Pagos", value: String(payments.length) },
        { label: "Plan Canje", value: planCanjeEnabled ? `${tradeInDevices.length} equipos / USD ${totals.tradeInCredit.toFixed(2)}` : "No" },
        { label: "Precio de venta", value: `USD ${totals.total.toFixed(2)}` },
        { label: "Pagos", value: `USD ${totals.totalPaid.toFixed(2)}` },
        { label: "Saldo", value: `USD ${totals.remaining.toFixed(2)}` },
        { label: "Costo total", value: "Calculado por servidor", sensitive: true, visibleForRoles: ["ADMIN", "SOCIO"] },
        { label: "Ganancia", value: "Calculada por servidor", sensitive: true, visibleForRoles: ["ADMIN", "SOCIO"] },
      ],
      confirmLabel: modeToSubmit === "CONFIRM_SALE" ? "Confirmar Venta" : "Registrar Sena",
      cancelLabel: "Volver a editar",
      loadingLabel: "Confirmando venta...",
      onConfirm: async () => {
        setError(null)
        if (modeToSubmit === "CONFIRM_SALE") setIsSubmitting(true)
        else setIsReserving(true)

        try {
          const response = await fetch(mode === "create" ? "/api/sales" : `/api/sales/${initialData?.id}`, {
            method: mode === "create" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload(modeToSubmit)),
          })

          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body?.error || body?.message || "No se pudo guardar la venta.")
          const saleId = body?.id || body?.sale?.id

          if (mode === "create") {
            setSuccess({
              saleId,
              customerName: selectedBuyer ? `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim() : "Consumidor Final",
              total: totals.total,
            })
          } else {
            router.refresh()
            router.push("/dashboard/sales")
          }
        } catch (submitError: any) {
          setError(submitError?.message || "No se pudo conectar con el servidor.")
        } finally {
          setIsSubmitting(false)
          setIsReserving(false)
        }
      },
    })
  }

  return {
    mode,
    activeRole,
    isAdmin,
    canSeeFinancials,
    planCanjeEnabled,
    setPlanCanjeEnabled,
    operationFlow,
    setOperationFlow,
    customerKind,
    setCustomerKind,
    activeStep,
    setActiveStep,
    selectedBuyer,
    setSelectedBuyer,
    selectedAppointmentId,
    setSelectedAppointmentId,
    meta,
    setMeta,
    items,
    setItems,
    payments,
    setPayments,
    saleStatus,
    setSaleStatus,
    saleIsLocked,
    canChangeStatus,
    tradeInDevices,
    editingTradeInDevice,
    setEditingTradeInDevice,
    tradeInConfig,
    configLoading,
    addTradeInDevice,
    removeTradeInDevice,
    totals,
    error,
    setError,
    isSubmitting,
    isReserving,
    success,
    submit,
    router,
    paymentId,
  }
}
