"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type {
  AppointmentNoSaleReason,
  AppointmentOutcome,
  AppointmentStatus,
  Buyer,
  PaymentMethod,
} from "@prisma/client"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { Role } from "@/lib/auth/roles"
import type { AppointmentInterestDraft } from "@/components/appointments/AppointmentInterestSection"
import { parseAppointmentMeta } from "@/components/appointments/appointmentUtils"
import type { TradeInConfigDto, TradeInDeviceDraft } from "@/components/trade-in/types"

export type AppointmentFormMode = "create" | "edit"

export type AppointmentFormInitialData = {
  id: string
  scheduledAt: string
  durationMinutes: number | null
  status: AppointmentStatus
  outcome: AppointmentOutcome
  noSaleReason: AppointmentNoSaleReason | null
  noSaleReasonOther: string | null
  resultNotes: string | null
  buyer: Buyer | null
  interests: (AppointmentInterestDraft & { id?: string })[]
}

export type AppointmentDepositFormDraft = {
  id: string
  amount: number
  method: PaymentMethod
  currency: "ARS" | "USD" | "USDT"
  notes: string
}

export type CustomerKind = "retail" | "wholesale"

type AppointmentFormOptions = {
  onSuccess?: (saved: { id?: string }) => void
}

function stripAppointmentMeta(value: string | null | undefined) {
  return (value ?? "").replace(/\n*\[appointment-meta\][\s\S]*?\[\/appointment-meta\]\n*/g, "").trim()
}

export function useAppointmentForm(mode: AppointmentFormMode, initialData?: AppointmentFormInitialData, options?: AppointmentFormOptions) {
  const router = useRouter()
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const appointmentMeta = useMemo(() => parseAppointmentMeta(initialData?.resultNotes), [initialData?.resultNotes])
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"
  const [activeStep, setActiveStep] = useState(0)
  const [planCanjeEnabled, setPlanCanjeEnabled] = useState(Boolean(appointmentMeta?.tradeInDevices?.length))
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(initialData?.buyer ?? null)
  const [customerKind, setCustomerKind] = useState<CustomerKind>("retail")
  const [wholesaleNotes, setWholesaleNotes] = useState(appointmentMeta?.wholesaleNotes ?? "")
  const [scheduledAt, setScheduledAt] = useState(() => (initialData ? new Date(initialData.scheduledAt) : new Date()))
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? 60)
  const [status, setStatus] = useState<AppointmentStatus>(initialData?.status ?? "PROGRAMADA")
  const [outcome, setOutcome] = useState<AppointmentOutcome>(initialData?.outcome ?? "PENDIENTE")
  const [noSaleReason, setNoSaleReason] = useState<AppointmentNoSaleReason | null>(initialData?.noSaleReason ?? null)
  const [noSaleReasonOther, setNoSaleReasonOther] = useState(initialData?.noSaleReasonOther ?? "")
  const [notes, setNotes] = useState(stripAppointmentMeta(initialData?.resultNotes))
  const [items, setItems] = useState<AppointmentInterestDraft[]>(
    initialData?.interests.map((item) => ({ ...item, _id: item._id || item.id || item.productId })) ?? [],
  )
  const [depositEnabled, setDepositEnabled] = useState(Boolean(appointmentMeta?.deposits?.length))
  const [deposits, setDeposits] = useState<AppointmentDepositFormDraft[]>(
    appointmentMeta?.deposits?.map((deposit) => ({
      id: crypto.randomUUID(),
      amount: Number(deposit.amount || 0),
      method: (deposit.method as PaymentMethod | undefined) ?? "EFECTIVO_PESOS",
      currency: (deposit.currency as AppointmentDepositFormDraft["currency"] | undefined) ?? "ARS",
      notes: deposit.notes ?? "",
    })) ?? [],
  )
  const [tradeInDevices, setTradeInDevices] = useState<TradeInDeviceDraft[]>(appointmentMeta?.tradeInDevices ?? [])
  const [editingTradeInDevice, setEditingTradeInDevice] = useState<TradeInDeviceDraft | null>(null)
  const [tradeInConfig, setTradeInConfig] = useState<TradeInConfigDto | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ appointmentId?: string } | null>(null)

  const agreedTotal = useMemo(() => {
    return items.reduce((total, item) => total + Number(item.agreedPrice ?? item.product?.salePrice ?? 0), 0)
  }, [items])

  const depositTotal = useMemo(() => deposits.reduce((total, deposit) => total + Number(deposit.amount || 0), 0), [deposits])
  const tradeInCredit = useMemo(
    () => (planCanjeEnabled ? tradeInDevices.reduce((total, device) => total + Number(device.finalValue || 0), 0) : 0),
    [planCanjeEnabled, tradeInDevices],
  )
  const balance = agreedTotal - depositTotal - tradeInCredit

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
        setTradeInConfig((await response.json()) as TradeInConfigDto)
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

  function addDeposit() {
    setDeposits((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        amount: 0,
        method: "EFECTIVO_PESOS",
        currency: "ARS",
        notes: "",
      },
    ])
  }

  function updateDeposit(id: string, patch: Partial<AppointmentDepositFormDraft>) {
    setDeposits((prev) => prev.map((deposit) => (deposit.id === id ? { ...deposit, ...patch } : deposit)))
  }

  function removeDeposit(id: string) {
    setDeposits((prev) => prev.filter((deposit) => deposit.id !== id))
  }

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

  function validate() {
    if (!selectedBuyer) return "Debe seleccionar o crear un cliente."
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return "La fecha y hora son obligatorias."
    if (!durationMinutes || durationMinutes <= 0) return "La duracion debe ser mayor a 0."
    if (mode === "edit" && outcome === "NO_SE_CONCRETO" && !noSaleReason) return "Debe indicar el motivo de no venta."
    if (mode === "edit" && outcome === "NO_SE_CONCRETO" && noSaleReason === "OTRO" && !noSaleReasonOther.trim()) {
      return "Debe detallar el motivo cuando selecciona OTRO."
    }
    return null
  }

  async function submitConfirmed() {
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const appointmentMeta = {
      deposits: depositEnabled ? deposits : [],
      wholesaleNotes: wholesaleNotes || null,
      tradeInDevices: planCanjeEnabled ? tradeInDevices : [],
      itemAdjustments: items.map((item) => ({
        productId: item.productId,
        agreedPrice: item.agreedPrice ?? Number(item.product?.salePrice ?? 0),
        quantity: item.quantity ?? 1,
        kind: item.kind ?? "NORMAL",
      })),
    }

    const metaBlock = `[appointment-meta]${JSON.stringify(appointmentMeta)}[/appointment-meta]`
    const composedNotes = [stripAppointmentMeta(notes), wholesaleNotes ? `Datos mayorista/envio: ${wholesaleNotes}` : null, metaBlock]
      .filter(Boolean)
      .join("\n\n")

    const payload = {
      buyerId: selectedBuyer?.id,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      status,
      outcome,
      noSaleReason: outcome === "NO_SE_CONCRETO" ? noSaleReason : null,
      noSaleReasonOther: outcome === "NO_SE_CONCRETO" && noSaleReason === "OTRO" ? noSaleReasonOther : null,
      notes: composedNotes,
      resultNotes: composedNotes,
      interests: items.map((item, index) => ({
        productId: item.productId,
        notes: item.notes,
        priority: item.priority || index + 1,
      })),
      deposits: depositEnabled ? deposits : [],
    }

    try {
      const response = await fetch(mode === "create" ? "/api/appointments" : `/api/appointments/${initialData?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "No se pudo guardar la reserva.")
      }

      const saved = (await response.json()) as { id?: string }
      if (options?.onSuccess) {
        options.onSuccess(saved)
      } else if (mode === "create") {
        setSuccess({ appointmentId: saved.id })
      } else {
        router.push("/dashboard/appointments")
      }
    } catch (error: any) {
      setError(error?.message || "No se pudo conectar con el servidor.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function requestSubmit() {
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    await confirmDialog.confirmAction({
      variant: mode === "create" ? "success" : "info",
      title: mode === "create" ? "Confirmar reserva" : "Guardar cambios de reserva",
      description:
        mode === "create"
          ? "Se registrara una reunion programada con los productos seleccionados y los datos del cliente."
          : "Se actualizaran los datos principales de la reserva.",
      details: [
        { label: "Cliente", value: selectedBuyer ? `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim() : "-" },
        { label: "Items", value: `${items.length}` },
        { label: "Precio acordado", value: `${agreedTotal}` },
        { label: "Seña local", value: `${depositTotal}` },
        { label: "Plan Canje", value: planCanjeEnabled ? `${tradeInDevices.length} equipos / USD ${tradeInCredit.toFixed(2)}` : "No" },
        { label: "Saldo", value: `${balance}` },
      ],
      confirmLabel: mode === "create" ? "Confirmar" : "Guardar cambios",
      cancelLabel: "Cancelar",
      loadingLabel: "Guardando...",
      onConfirm: submitConfirmed,
    })
  }

  return {
    mode,
    activeRole,
    isAdmin,
    activeStep,
    setActiveStep,
    planCanjeEnabled,
    setPlanCanjeEnabled,
    selectedBuyer,
    setSelectedBuyer,
    customerKind,
    setCustomerKind,
    wholesaleNotes,
    setWholesaleNotes,
    scheduledAt,
    setScheduledAt,
    durationMinutes,
    setDurationMinutes,
    status,
    setStatus,
    outcome,
    setOutcome,
    noSaleReason,
    setNoSaleReason,
    noSaleReasonOther,
    setNoSaleReasonOther,
    notes,
    setNotes,
    items,
    setItems,
    depositEnabled,
    setDepositEnabled,
    deposits,
    addDeposit,
    updateDeposit,
    removeDeposit,
    tradeInDevices,
    editingTradeInDevice,
    setEditingTradeInDevice,
    tradeInConfig,
    configLoading,
    addTradeInDevice,
    removeTradeInDevice,
    error,
    isSubmitting,
    success,
    agreedTotal,
    depositTotal,
    tradeInCredit,
    balance,
    requestSubmit,
    router,
  }
}
