import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import { getConditionLabel, getProductDisplayCapacity, getProductDisplayColor, getProductDisplayLabel, getProductDisplayModel } from "@/lib/products/display"
import type { SerializedSale } from "./types"

export function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatUsd(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

export function formatSaleDate(iso: string | null, pattern = "dd/MM/yyyy HH:mm") {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return formatInTimeZone(date, AR_TIME_ZONE, pattern)
}

export function isTodayInArgentina(iso: string | null) {
  if (!iso) return false
  return formatInTimeZone(new Date(iso), AR_TIME_ZONE, "yyyy-MM-dd") === formatInTimeZone(new Date(), AR_TIME_ZONE, "yyyy-MM-dd")
}

export function getSaleBuyerName(sale: SerializedSale) {
  if (sale.buyer) return [sale.buyer.name, sale.buyer.surname].filter(Boolean).join(" ")
  return sale.customerName || "Consumidor Final"
}

export function displaySaleUser(user: SerializedSale["createdByUser"]) {
  if (!user) return "-"
  return user.name?.trim() || user.email
}

export function getSaleOrigin(sale: SerializedSale) {
  if (sale.appointments?.length) return "Reserva"
  const origin = sale.origin?.trim()
  if (!origin) return "Directa"
  if (/instagram/i.test(origin)) return "Instagram"
  if (/local/i.test(origin)) return "Local"
  if (/reserva/i.test(origin)) return "Reserva"
  if (/directa/i.test(origin)) return "Directa"
  return "Otro"
}

export function getSaleSearchText(sale: SerializedSale) {
  return [
    sale.id,
    getSaleBuyerName(sale),
    sale.origin,
    sale.createdBy,
    sale.createdByUser?.email,
    ...sale.items.flatMap((item) => [
      getProductDisplayLabel(item.product),
      getProductDisplayModel(item.product),
      item.product?.imei,
      getProductDisplayCapacity(item.product),
      getProductDisplayColor(item.product),
      item.product?.condition,
      getConditionLabel(item.product?.condition),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function getMarginBadgeClass(value: string | number | null | undefined) {
  const margin = toNumber(value)
  if (margin > 0) return "text-success"
  if (margin < 0) return "text-error"
  return "badge-ghost"
}

export function getStatusBadgeClass(status: string | null | undefined) {
  if (status === "SENADA") return "badge-warning"
  if (status === "CANCELADA") return "badge-error"
  return "badge-success"
}
