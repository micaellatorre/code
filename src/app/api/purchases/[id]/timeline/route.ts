import { NextRequest, NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"

type Ctx = {
  params: Promise<{ id: string }>
}

function titleForAction(action: string) {
  switch (action) {
    case "CREATE":
      return "Compra registrada"
    case "PAYMENT_CREATED":
      return "Pago registrado"
    case "STOCK_CHANGE":
      return "Ingreso a inventario"
    case "UPDATE":
      return "Compra actualizada"
    case "DELETE":
      return "Compra eliminada"
    default:
      return "Evento de compra"
  }
}

function derivedPaymentStatus(purchase: {
  currency: string
  downPayment: unknown
  totalCost: unknown
  payments: Array<{ amountUsd: unknown }>
}) {
  const paymentsUsd = purchase.payments.reduce((acc, payment) => acc + Number(payment.amountUsd ?? 0), 0)
  const legacyDownPaymentUsd = purchase.currency === "USD" || purchase.currency === "USDT"
    ? Number(purchase.downPayment ?? 0)
    : 0
  const paidUsd = paymentsUsd + legacyDownPaymentUsd
  const totalCost = Number(purchase.totalCost)
  return paidUsd >= totalCost ? "PAID" : paidUsd > 0 ? "PARTIAL" : "CURRENT_ACCOUNT"
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const { id } = await params
  const purchase = await prisma.purchase.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      date: true,
      supplier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      totalCost: true,
      downPayment: true,
      currency: true,
      payments: { select: { amountUsd: true } },
      items: { select: { units: true, product: { select: { type: true } } } },
    },
  })
  if (!purchase) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 })

  const events = await prisma.auditLog.findMany({
    where: {
      tenantId,
      module: "PURCHASE",
      entityType: "Purchase",
      entityId: purchase.id,
    },
    orderBy: { createdAt: "asc" },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json({
    purchase: {
      id: purchase.id,
      date: purchase.date.toISOString(),
      supplier: { id: purchase.supplier.id, name: purchase.supplier.name },
      branch: purchase.branch ? { id: purchase.branch.id, name: purchase.branch.name } : null,
      totalCost: purchase.totalCost.toString(),
      currency: purchase.currency,
      totalUnits: purchase.items.reduce((acc, item) => acc + item.units, 0),
      productTypes: Array.from(new Set(purchase.items.map((item) => item.product.type))),
      paymentStatus: derivedPaymentStatus(purchase),
    },
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      title: titleForAction(event.action),
      description: event.detail,
      createdAt: event.createdAt.toISOString(),
      actor: event.actorUser ? { id: event.actorUser.id, name: event.actorUser.name, email: event.actorUser.email } : null,
      actorRole: event.actorRole,
      simulatedRole: event.simulatedRole,
      executedByAdminInSimulation: event.executedByAdminInSimulation,
      metadata: event.metadata,
    })),
  })
}
