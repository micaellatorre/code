import { NextResponse } from "next/server"
import { Prisma, type PaymentMethod } from "@prisma/client"
import { z } from "zod"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import {
  getBlueSellRateSnapshot,
  getPaymentPricingSettings,
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

function decimal(value: string | number) {
  const result = new Prisma.Decimal(String(value))
  if (!result.isFinite() || result.lessThanOrEqualTo(0)) {
    throw new Error("El precio base USD debe ser mayor a 0.")
  }
  return result
}

function currencyForMethod(method: PaymentMethod) {
  if (method === "EFECTIVO_PESOS" || method === "TRANSFERENCIA_ARS" || method === "BNA_CUOTAS") return "ARS" as const
  if (method === "USDT") return "USDT" as const
  return "USD" as const
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

    const baseTotalUsd = decimal(parsed.data.baseTotalUsd)
    const [settings, rateSnapshot] = await Promise.all([
      getPaymentPricingSettings(tenantId),
      getBlueSellRateSnapshot(),
    ])

    const quickMethods: PaymentMethod[] = [
      "EFECTIVO_USD",
      "EFECTIVO_PESOS",
      "TRANSFERENCIA_ARS",
      "USDT",
      ...(settings.bnaInstallmentsEnabled ? (["BNA_CUOTAS"] as PaymentMethod[]) : []),
    ]

    const quickQuotes = quickMethods.map((method) => serializePricingResult(quoteFromCoveredUsd({
      method,
      coveredUsd: baseTotalUsd,
      exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
      settings,
      installments: method === "BNA_CUOTAS" ? settings.bnaDefaultInstallments : null,
    })))

    let coveredUsd = new Prisma.Decimal(0)
    const payments = []

    for (const input of parsed.data.payments) {
      const method = input.method as PaymentMethod
      const remaining = Prisma.Decimal.max(baseTotalUsd.sub(coveredUsd), 0)
      const result = input.useRemaining
        ? quoteFromCoveredUsd({
            method,
            coveredUsd: remaining,
            exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
            settings,
            installments: input.installments,
          })
        : priceNativePayment({
            method,
            currency: currencyForMethod(method),
            amount: decimal(input.amount ?? 0),
            exchangeRate: currencyForMethod(method) === "ARS" ? rateSnapshot.rate : null,
            settings,
            installments: input.installments,
          })

      coveredUsd = coveredUsd.add(result.coveredUsd)
      payments.push(serializePricingResult(result))
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
        transferFeeRatePct: settings.transferFeeRatePct.toFixed(2),
        bnaInstallmentsEnabled: settings.bnaInstallmentsEnabled,
        bnaMarkupRatePct: settings.bnaMarkupRatePct.toFixed(2),
        bnaDefaultInstallments: settings.bnaDefaultInstallments,
      },
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
