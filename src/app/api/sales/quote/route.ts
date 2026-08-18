import { NextResponse } from "next/server"
import { Prisma, type PaymentMethod } from "@prisma/client"
import { z } from "zod"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import {
  getBlueSellRateSnapshot,
  getPaymentPricingSettings,
  expectedCurrency,
  priceNativePayment,
  quoteFromCoveredUsd,
  serializePricingResult,
} from "@/lib/domain/payment-pricing"

const supportedMethods = [
  "EFECTIVO_USD",
  "EFECTIVO_PESOS",
  "TRANSFERENCIA_ARS",
  "USDT",
  "BNA_CUOTAS",
] as const

const paymentSchema = z.object({
  method: z.enum(supportedMethods),
  amount: z.union([z.string(), z.number()]).optional(),
  useRemaining: z.boolean().optional().default(false),
  installments: z.coerce.number().int().min(1).max(12).optional(),
})

const quoteSchema = z.object({
  baseTotalUsd: z.union([z.string(), z.number()]),
  payments: z.array(paymentSchema).optional().default([]),
})

type QuoteVisibilityMode = "ADMIN" | "VENDEDOR"
type SerializedPricingLine = ReturnType<typeof serializePricingResult>
type PublicPricingLine = Omit<SerializedPricingLine, "surchargePct" | "customerRebatePct"> & {
  surchargePct: string | null
  customerRebatePct: string | null
}

function visibilityModeForRole(role: string | null | undefined): QuoteVisibilityMode {
  return role === "ADMIN" ? "ADMIN" : "VENDEDOR"
}

function sanitizePricingLine(line: SerializedPricingLine, visibilityMode: QuoteVisibilityMode): PublicPricingLine {
  if (visibilityMode === "ADMIN") return line

  return {
    ...line,
    surchargePct: null,
    customerRebatePct: null,
  }
}

function serializePricingResultForVisibility(result: Parameters<typeof serializePricingResult>[0], visibilityMode: QuoteVisibilityMode) {
  return sanitizePricingLine(serializePricingResult(result), visibilityMode)
}

function normalizeDecimalInput(value: string | number | null | undefined) {
  if (value == null) return ""
  const trimmed = String(value).trim()
  if (!trimmed) return ""
  if (trimmed.includes(".") && trimmed.includes(",")) return trimmed.replace(/\./g, "").replace(",", ".")
  if (trimmed.includes(",")) return trimmed.replace(",", ".")
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) return trimmed.replace(/\./g, "")
  return trimmed
}

function hasDecimalInput(value: string | number | null | undefined) {
  return normalizeDecimalInput(value) !== ""
}

function decimal(value: string | number | null | undefined, label: string) {
  const normalized = normalizeDecimalInput(value)
  if (!normalized) {
    throw new Error(`${label} debe ser mayor a 0.`)
  }

  let result: Prisma.Decimal
  try {
    result = new Prisma.Decimal(normalized)
  } catch {
    throw new Error(`${label} no es valido.`)
  }

  if (!result.isFinite() || result.lessThanOrEqualTo(0)) {
    throw new Error(`${label} debe ser mayor a 0.`)
  }
  return result
}

function currencyForMethod(method: PaymentMethod) {
  const currency = expectedCurrency(method)
  if (!currency) throw new Error("Medio de pago no soportado.")
  return currency
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const parsed = quoteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
    if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

    const baseTotalUsd = decimal(parsed.data.baseTotalUsd, "El precio base USD")
    const visibilityMode = visibilityModeForRole(auth.session.user.activeRole)
    const [settings, rateSnapshot] = await Promise.all([
      getPaymentPricingSettings(tenantId),
      getBlueSellRateSnapshot(),
    ])
    const quoteSettings = { ...settings, bnaInstallmentsEnabled: true }

    const quickMethods: PaymentMethod[] = [
      "EFECTIVO_USD",
      "EFECTIVO_PESOS",
      "TRANSFERENCIA_ARS",
      "USDT",
      "BNA_CUOTAS",
    ]

    const quickQuotes = quickMethods.map((method) => serializePricingResultForVisibility(quoteFromCoveredUsd({
      method,
      coveredUsd: baseTotalUsd,
      exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
      settings: quoteSettings,
      installments: method === "BNA_CUOTAS" ? quoteSettings.bnaDefaultInstallments : null,
    }), visibilityMode))

    let coveredUsd = new Prisma.Decimal(0)
    const payments: PublicPricingLine[] = []

    for (const input of parsed.data.payments) {
      if (!input.useRemaining && !hasDecimalInput(input.amount)) continue

      const method = input.method as PaymentMethod
      const remaining = Prisma.Decimal.max(baseTotalUsd.sub(coveredUsd), 0)
      const result = input.useRemaining
        ? quoteFromCoveredUsd({
            method,
            coveredUsd: remaining,
            exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
            settings: quoteSettings,
            installments: input.installments,
          })
        : priceNativePayment({
            method,
            currency: currencyForMethod(method),
            amount: decimal(input.amount, "El importe"),
            exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
            settings: quoteSettings,
            installments: input.installments,
          })

      coveredUsd = coveredUsd.add(result.coveredBaseUsd)
      payments.push(serializePricingResultForVisibility(result, visibilityMode))
    }

    const remainingUsd = Prisma.Decimal.max(baseTotalUsd.sub(coveredUsd), 0)

    return NextResponse.json({
      baseTotalUsd: baseTotalUsd.toFixed(2),
      exchangeRate: {
        rate: rateSnapshot.rate.toFixed(4),
        source: rateSnapshot.source,
        fetchedAt: rateSnapshot.fetchedAt.toISOString(),
      },
      settings: {
        transferFeeEnabled: settings.transferFeeEnabled,
        transferFeeRatePct: visibilityMode === "ADMIN" ? settings.transferFeeRatePct.toFixed(2) : null,
        bnaInstallmentsEnabled: quoteSettings.bnaInstallmentsEnabled,
        bnaMarkupRatePct: visibilityMode === "ADMIN" ? quoteSettings.bnaMarkupRatePct.toFixed(2) : null,
        bnaDefaultInstallments: quoteSettings.bnaDefaultInstallments,
        bnaCustomerRebatePct: visibilityMode === "ADMIN" ? quoteSettings.bnaCustomerRebatePct.toFixed(2) : null,
        bnaCustomerRebateCapArs: quoteSettings.bnaCustomerRebateCapArs.toFixed(2),
      },
      visibilityMode,
      quickQuotes,
      payments,
      coveredUsd: coveredUsd.toFixed(6),
      remainingUsd: remainingUsd.toFixed(6),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo calcular la cotizacion"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
