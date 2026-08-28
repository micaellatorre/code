import { getProductColorPresentation, getProductDisplayCapacity, getProductDisplayModel } from "@/lib/products/display"
import type { ReceiptPreview, SaleItemSummary, SalePaymentSummary, SerializedSale } from "./types"
import { displaySaleUser, formatSaleDate, getSaleBuyerName, toNumber } from "./salesUtils"

export const RECEIPT_CHECK_ITEMS = [
  "Pantalla",
  "Cámaras",
  "Face ID",
  "Parlantes",
  "Micrófono",
  "Flash",
  "Botones",
  "Puerto de carga",
  "Wi-Fi",
]

export function formatUsdReceipt(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(toNumber(value))
    .replace("USD", "US$")
}

export function formatArsReceipt(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

export function formatNativePaymentAmount(value: string | number | null | undefined, currency: string | null | undefined) {
  if (currency === "ARS") return formatArsReceipt(value)
  if (currency === "USDT") return `USDT ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(value))}`
  return formatUsdReceipt(value)
}

export function formatExchangeRate(value: string | number | null | undefined) {
  if (value == null || value === "") return "-"
  return `1 USD = ${formatArsReceipt(value)}`
}

export function formatBuyerType(type: string | null | undefined) {
  if (type === "MAYORISTA") return "Mayorista"
  if (type === "MINORISTA") return "Minorista"
  return "-"
}

export function orderReceiptItems(items: SaleItemSummary[]) {
  const byId = new Set(items.map((item) => item.id))
  const childrenByParent = new Map<string, SaleItemSummary[]>()
  const roots: SaleItemSummary[] = []

  for (const item of items) {
    if (item.parentItemId && byId.has(item.parentItemId)) {
      childrenByParent.set(item.parentItemId, [...(childrenByParent.get(item.parentItemId) ?? []), item])
    } else {
      roots.push(item)
    }
  }

  const ordered: { item: SaleItemSummary; depth: number }[] = []

  function append(item: SaleItemSummary, depth: number) {
    ordered.push({ item, depth })
    for (const child of childrenByParent.get(item.id) ?? []) {
      append(child, depth + 1)
    }
  }

  for (const root of roots) append(root, 0)
  return ordered
}

function safeText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

function paymentMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    EFECTIVO_PESOS: "Efectivo ARS",
    EFECTIVO_USD: "Efectivo USD",
    TRANSFERENCIA_ARS: "Transferencia ARS",
    TRANSFERENCIA_USD: "Transferencia USD",
    BNA_CUOTAS: "BNA",
    USDT: "USDT",
    TARJETA: "Tarjeta",
    PLAN_CANJE: "Plan Canje",
  }
  return labels[String(method ?? "")] ?? String(method ?? "Pago")
}

function snapshotValue(payment: SalePaymentSummary, key: string) {
  const snapshot = payment.pricingSnapshot
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null
  const value = (snapshot as Record<string, unknown>)[key]
  return value == null ? null : String(value)
}

function paymentSecondaryDetails(payment: SalePaymentSummary) {
  const rebateAmount = snapshotValue(payment, "customerRebateAmount")
  return [
    payment.installments && payment.installmentAmount
      ? `${payment.installments} cuotas de ${formatArsReceipt(payment.installmentAmount)}`
      : null,
    rebateAmount ? `Reintegro informativo cliente: ${formatArsReceipt(rebateAmount)}` : null,
    payment.note ? safeText(payment.note) : null,
  ].filter((item): item is string => Boolean(item))
}

function paymentEquivalentUsd(payment: SalePaymentSummary) {
  if (payment.coveredBaseUsd != null && payment.coveredBaseUsd !== "") return formatUsdReceipt(payment.coveredBaseUsd)
  if (payment.amountUsd != null && payment.amountUsd !== "") return formatUsdReceipt(payment.amountUsd)
  if (payment.currency === "USD") return formatUsdReceipt(payment.amount)
  return "-"
}

function paymentConversion(payment: SalePaymentSummary) {
  if (payment.currency === "ARS") return payment.exchangeRate ? formatExchangeRate(payment.exchangeRate) : "-"
  if (payment.currency === "USDT" && payment.exchangeRate) return formatExchangeRate(payment.exchangeRate)
  return "-"
}

function getItemUnitPrice(item: SaleItemSummary) {
  const unitPrice = toNumber(item.unitPrice)
  if (unitPrice > 0) return unitPrice

  const units = item.units > 0 ? item.units : 1
  return toNumber(item.lineTotal) / units
}

function formatPhoneTechnicalDetails(item: SaleItemSummary) {
  const product = item.product
  const capacity = getProductDisplayCapacity(product)
  return {
    imei: safeText(product.imei),
    battery: product.batteryPct == null ? null : `${product.batteryPct}%`,
    capacity,
    color: getProductColorPresentation(product),
  }
}

export function buildReceiptViewModel(preview: ReceiptPreview) {
  const { sale, receipt, branding } = preview
  const brandName = safeText(branding?.tenantName) || "GP Importaciones"
  const buyerFullName = sale.buyer ? [sale.buyer.name, sale.buyer.surname].filter(Boolean).join(" ").trim() : getSaleBuyerName(sale)
  const seller = sale.closer ? displaySaleUser(sale.closer) : displaySaleUser(sale.createdByUser)

  return {
    brand: {
      name: brandName,
      logoDataUrl: branding?.logoDataUrl ?? null,
      warrantyPolicyText: branding?.warrantyPolicyText?.trim() ?? "",
    },
    branch: {
      id: sale.branch?.id ?? sale.branchId,
      name: safeText(sale.branch?.name),
      phone: safeText(sale.branch?.phone),
      address: safeText(sale.branch?.address),
      city: safeText(sale.branch?.city),
      email: safeText(sale.branch?.email),
    },
    operation: {
      number: receipt.formattedNumber,
      date: formatSaleDate(sale.date, "dd/MM/yyyy"),
      time: formatSaleDate(sale.date, "HH:mm"),
      seller: seller === "-" ? null : seller,
      total: formatUsdReceipt(sale.total),
    },
    buyer: {
      fullName: buyerFullName || "Consumidor Final",
      name: safeText(sale.buyer?.name),
      surname: safeText(sale.buyer?.surname),
      businessName: safeText(sale.buyer?.businessName),
      type: formatBuyerType(sale.buyer?.type ?? sale.saleType),
      dni: safeText(sale.buyer?.dni),
      cuit: safeText(sale.buyer?.cuit),
      phone: safeText(sale.buyer?.phone),
      email: safeText(sale.buyer?.email),
    },
    items: orderReceiptItems(sale.items).map(({ item, depth }) => {
      const phoneDetails = item.product.type === "PHONE" ? formatPhoneTechnicalDetails(item) : null
      return {
        id: item.id,
        depth,
        kind: item.kind,
        description: getProductDisplayModel(item.product),
        quantity: String(item.units),
        unitPrice: formatUsdReceipt(getItemUnitPrice(item)),
        lineTotal: formatUsdReceipt(item.lineTotal),
        phoneDetails,
      }
    }),
    payments: sale.payments.map((payment) => ({
      id: payment.id ?? `${payment.method}-${payment.currency}-${payment.amount}`,
      method: paymentMethodLabel(payment.method),
      details: paymentSecondaryDetails(payment),
      originalAmount: formatNativePaymentAmount(payment.amount, payment.currency),
      conversion: paymentConversion(payment),
      equivalentUsd: paymentEquivalentUsd(payment),
    })),
    checks: RECEIPT_CHECK_ITEMS,
    footer: "Comprobante interno correspondiente a la operación registrada en el sistema.",
  }
}
