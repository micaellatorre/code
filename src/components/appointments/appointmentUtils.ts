import { formatInTimeZone } from "date-fns-tz"
import type { AppointmentOutcome, AppointmentStatus } from "@prisma/client"
import { AR_TIME_ZONE } from "@/lib/timezone"
import type { TradeInDeviceDraft } from "@/components/trade-in/types"
import type { AppointmentInterestSummary, SerializedAppointment } from "./types"

export const OUTCOME_OPTIONS: AppointmentOutcome[] = [
  "PENDIENTE",
  "VENTA_CONCRETADA",
  "NO_SE_CONCRETO",
  "SENADO",
  "SENADO_EN_CAMINO",
  "SENADO_EN_STOCK",
]

export const STATUS_OPTIONS: AppointmentStatus[] = ["PROGRAMADA", "CONCRETADA", "CANCELADA", "NO_SE_PRESENTO"]

export function displayUser(user: SerializedAppointment["createdByUser"]) {
  if (!user) return "-"
  return user.name?.trim() || user.email
}

export function formatAppointmentDate(iso: string, pattern = "dd/MM/yyyy HH:mm") {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Fecha invalida"
  return formatInTimeZone(date, AR_TIME_ZONE, pattern)
}

export function isTodayInArgentina(iso: string) {
  const today = formatInTimeZone(new Date(), AR_TIME_ZONE, "yyyy-MM-dd")
  const appointmentDay = formatInTimeZone(new Date(iso), AR_TIME_ZONE, "yyyy-MM-dd")
  return today === appointmentDay
}

export function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0)
}

export function getAppointmentReservedValue(appointment: SerializedAppointment) {
  return appointment.interests.reduce((total, interest) => total + Number(interest.product?.salePrice ?? 0), 0)
}

export function parseAppointmentMeta(notes: string | null | undefined) {
  if (!notes) return null
  const match = notes.match(/\[appointment-meta\]([\s\S]*?)\[\/appointment-meta\]/)
  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1]) as {
      deposits?: { amount?: number | string; method?: string; currency?: string; notes?: string }[]
      wholesaleNotes?: string
      itemAdjustments?: unknown[]
      tradeInDevices?: TradeInDeviceDraft[]
    }
  } catch {
    return null
  }
}

export function getAppointmentDepositTotal(appointment: Pick<SerializedAppointment, "resultNotes">) {
  const meta = parseAppointmentMeta(appointment.resultNotes)
  return meta?.deposits?.reduce((total, deposit) => total + Number(deposit.amount || 0), 0) ?? 0
}

export function getInterestsSearchText(interests: AppointmentInterestSummary[]) {
  return interests
    .map((interest) =>
      [
        interest.product?.modelName,
        interest.product?.type,
        interest.product?.imei,
        interest.product?.capacityGB,
        interest.product?.color,
        interest.product?.state,
        interest.notes,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase()
}

export function matchesStatusSegment(appointment: SerializedAppointment, segment: "active" | "cancelled" | "sold") {
  if (segment === "sold") return appointment.outcome === "VENTA_CONCRETADA"

  if (segment === "cancelled") {
    return (
      appointment.status === "CANCELADA" ||
      appointment.status === "NO_SE_PRESENTO" ||
      appointment.outcome === "NO_SE_CONCRETO"
    )
  }

  return (
    appointment.status === "PROGRAMADA" ||
    (appointment.status === "CONCRETADA" &&
      ["PENDIENTE", "SENADO", "SENADO_EN_CAMINO", "SENADO_EN_STOCK"].includes(appointment.outcome))
  )
}

export function getStatusBadgeClass(status: AppointmentStatus) {
  const map: Record<AppointmentStatus, string> = {
    PROGRAMADA: "badge-info",
    CONCRETADA: "badge-success",
    CANCELADA: "badge-error",
    NO_SE_PRESENTO: "badge-warning",
  }
  return map[status]
}

export function getOutcomeBadgeClass(outcome: AppointmentOutcome) {
  if (outcome === "VENTA_CONCRETADA") return "badge-success"
  if (outcome === "NO_SE_CONCRETO") return "badge-error"
  if (outcome === "SENADO" || outcome === "SENADO_EN_CAMINO") return "badge-warning"
  if (outcome === "SENADO_EN_STOCK") return "badge-info"
  return "badge-ghost"
}

export function formatRelativeAppointmentTime(iso: string) {
  const date = new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  let value: string
  if (absMs >= day) value = `${Math.round(absMs / day)} dias`
  else if (absMs >= hour) value = `${Math.round(absMs / hour)} horas`
  else value = `${Math.max(1, Math.round(absMs / minute))} min`

  return diffMs >= 0 ? `Proximo: ${value}` : `Ocurrio hace ${value}`
}
