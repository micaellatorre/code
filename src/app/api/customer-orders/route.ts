import { Currency, PaymentMethod, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { resolveOperationBranch } from "@/lib/domain/user-branches"
import { buildPaymentPricingSnapshot, getBlueSellRateSnapshot, getPaymentPricingSettings, priceNativePayment } from "@/lib/domain/payment-pricing"
import { createCustomerOrder, listCustomerOrders, type CustomerOrderSource, type CustomerOrderItemKind, type PricedOrderPayment } from "@/lib/domain/customer-orders"

type Body = {
  buyerId?: string
  branchId?: string | null
  assignedSellerId?: string | null
  appointmentId?: string | null
  source?: CustomerOrderSource
  estimatedDeliveryAt?: string | null
  notes?: string | null
  items?: Array<{
    kind?: CustomerOrderItemKind
    stockProductId?: string | null
    catalogModelId?: string | null
    catalogCapacityId?: string | null
    catalogColorId?: string | null
    description?: string
    modelName?: string | null
    capacityGB?: number | null
    color?: string | null
    condition?: string | null
    quantity?: number
    unitPriceUsd?: number | string
    unitCostUsd?: number | string | null
    notes?: string | null
  }>
  payments?: Array<{
    method?: string
    currency?: string
    amount?: number | string
    exchangeRate?: number | string | null
    cashAccountId?: string | null
    installments?: number | null
    paidAt?: string | null
    note?: string | null
  }>
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo procesar el pedido."
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  return NextResponse.json(await listCustomerOrders(tenantId))
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }
  if (!body.buyerId) return NextResponse.json({ error: "buyerId es obligatorio." }, { status: 400 })
  if (!Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ error: "El pedido requiere ítems." }, { status: 400 })
  if (!Array.isArray(body.payments) || body.payments.length === 0) return NextResponse.json({ error: "El pedido requiere al menos una seña/pago." }, { status: 400 })

  try {
    const branch = await resolveOperationBranch({
      tenantId,
      userId: auth.session.user.id,
      role: auth.session.user.activeRole,
      requestedBranchId: body.branchId ?? null,
    })
    if (!branch) throw new Error("Sucursal operativa no disponible.")

    const pricingSettings = await getPaymentPricingSettings(tenantId)
    const requiresArs = body.payments.some((payment) => payment.currency === "ARS")
    const exchangeSnapshot = requiresArs ? await getBlueSellRateSnapshot() : null
    const pricedPayments: PricedOrderPayment[] = body.payments.map((payment) => {
      const method = payment.method as PaymentMethod
      const currency = payment.currency as Currency
      if (!Object.values(PaymentMethod).includes(method)) throw new Error("Medio de pago inválido.")
      if (!Object.values(Currency).includes(currency)) throw new Error("Moneda inválida.")
      const amount = new Prisma.Decimal(payment.amount ?? 0)
      const exchangeRate = currency === "ARS"
        ? new Prisma.Decimal(payment.exchangeRate ?? exchangeSnapshot?.rate ?? 0)
        : null
      const priced = priceNativePayment({ method, currency, amount, exchangeRate, settings: pricingSettings, installments: payment.installments })
      return {
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
        cashAccountId: payment.cashAccountId ?? null,
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
        note: payment.note ?? null,
      }
    })

    const order = await createCustomerOrder({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      input: {
        buyerId: body.buyerId,
        branchId: branch.id,
        assignedSellerId: body.assignedSellerId ?? auth.session.user.id,
        appointmentId: body.appointmentId ?? null,
        source: body.source ?? "INTERNAL",
        estimatedDeliveryAt: body.estimatedDeliveryAt ? new Date(body.estimatedDeliveryAt) : null,
        notes: body.notes ?? null,
        items: body.items.map((item) => ({
          kind: item.kind ?? (item.stockProductId ? "STOCK" : "ON_DEMAND"),
          stockProductId: item.stockProductId ?? null,
          catalogModelId: item.catalogModelId ?? null,
          catalogCapacityId: item.catalogCapacityId ?? null,
          catalogColorId: item.catalogColorId ?? null,
          description: String(item.description ?? item.modelName ?? "Producto solicitado").trim(),
          modelName: item.modelName ?? null,
          capacityGB: item.capacityGB ?? null,
          color: item.color ?? null,
          condition: item.condition ?? null,
          quantity: Number(item.quantity ?? 1),
          unitPriceUsd: new Prisma.Decimal(item.unitPriceUsd ?? 0),
          unitCostUsd: item.unitCostUsd == null ? null : new Prisma.Decimal(item.unitCostUsd),
          notes: item.notes ?? null,
        })),
        payments: pricedPayments,
      },
    })
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
