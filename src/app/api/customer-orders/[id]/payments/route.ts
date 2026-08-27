import { Currency, PaymentMethod, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { addCustomerOrderPayment } from "@/lib/domain/customer-orders"
import { buildPaymentPricingSnapshot, getBlueSellRateSnapshot, getPaymentPricingSettings, priceNativePayment } from "@/lib/domain/payment-pricing"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await context.params

  try {
    const body = await request.json()
    const method = body?.method as PaymentMethod
    const currency = body?.currency as Currency
    if (!Object.values(PaymentMethod).includes(method)) throw new Error("Medio de pago inválido.")
    if (!Object.values(Currency).includes(currency)) throw new Error("Moneda inválida.")

    const settings = await getPaymentPricingSettings(tenantId)
    const exchangeSnapshot = currency === "ARS" ? await getBlueSellRateSnapshot() : null
    const exchangeRate = currency === "ARS"
      ? new Prisma.Decimal(body?.exchangeRate ?? exchangeSnapshot?.rate ?? 0)
      : null
    const priced = priceNativePayment({
      method,
      currency,
      amount: new Prisma.Decimal(body?.amount ?? 0),
      exchangeRate,
      settings,
      installments: body?.installments ?? null,
    })

    const result = await addCustomerOrderPayment({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      orderId: id,
      payment: {
        method,
        currency,
        amount: priced.amount,
        exchangeRate: priced.exchangeRate,
        amountUsd: priced.amountUsd,
        coveredBaseUsd: priced.coveredBaseUsd,
        surchargePct: priced.surchargePct,
        surchargeAmount: priced.surchargeAmount,
        installments: priced.installments,
        installmentAmount: priced.installmentAmount,
        pricingSnapshot: buildPaymentPricingSnapshot(priced, exchangeSnapshot),
        cashAccountId: body?.cashAccountId ?? null,
        paidAt: body?.paidAt ? new Date(body.paidAt) : new Date(),
        note: body?.note ?? null,
      },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el pago" }, { status: 400 })
  }
}
