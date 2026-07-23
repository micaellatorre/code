import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import FilterableSalesTable from "@/components/FilterableSalesTable"
import prisma from "@/lib/prisma"
import type { Metadata } from "next"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

export const metadata: Metadata = {
  title: "Ventas",
  description: "Registro de operaciones comerciales y margen de rentabilidad",
}

export const dynamic = "force-dynamic"

function toStr(v: unknown) {
  return v == null ? null : String(v)
}

export default async function SalesPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const canSeeFinancials = session.user.activeRole === "ADMIN" || session.user.activeRole === "SOCIO"

  const sales = await prisma.sale.findMany({
    where: { tenantId },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, code: true, name: true } },
      buyer: { select: { id: true, type: true, name: true, surname: true, businessName: true, phone: true, instagram: true, email: true } },
      payments: { select: { id: true, method: true, currency: true, amount: true, exchangeRate: true, amountUsd: true, cashAccountId: true, paidAt: true, note: true }, orderBy: { paidAt: "asc" } },
      appointments: { select: { id: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              modelName: true,
              type: true,
              capacityGB: true,
              condition: true,
              batteryPct: true,
              color: true,
              imei: true,
              salePrice: true,
              state: true,
              stock: true,
              stockAvailable: true,
              costPrice: canSeeFinancials,
              shippingCost: canSeeFinancials,
            },
          },
        },
      },
    },
  })

  const serialized = sales.map((sale) => ({
    id: sale.id,
    tenantId: sale.tenantId,
    branchId: sale.branchId,
    branch: sale.branch,
    date: sale.date ? sale.date.toISOString() : null,
    customerName: sale.customerName,
    origin: sale.origin,
    payment: sale.payments.length > 0 ? sale.payments[0].method : null,
    notes: sale.notes,
    status: sale.status,
    saleType: sale.saleType,
    amountPaid: toStr(sale.amountPaid),
    balanceDue: toStr(sale.balanceDue),
    subtotal: toStr(sale.subtotal),
    extraCosts: toStr(sale.extraCosts),
    total: toStr(sale.total),
    profit: canSeeFinancials ? toStr(sale.profit) : null,
    costTotal: canSeeFinancials ? toStr(sale.costTotal) : null,
    createdAt: sale.createdAt ? sale.createdAt.toISOString() : null,
    createdBy: sale.user?.name || sale.user?.email || "-",
    createdByUser: sale.user
      ? {
          id: sale.user.id,
          name: sale.user.name,
          email: sale.user.email ?? "",
        }
      : null,
    buyer: sale.buyer
      ? {
          id: sale.buyer.id,
          type: sale.buyer.type,
          name: sale.buyer.name,
          surname: sale.buyer.surname,
          businessName: sale.buyer.businessName,
          phone: sale.buyer.phone,
          instagram: sale.buyer.instagram,
          email: sale.buyer.email,
        }
      : null,
    appointments: sale.appointments.map((appointment) => ({ id: appointment.id })),
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      currency: payment.currency,
      amount: toStr(payment.amount),
      exchangeRate: toStr(payment.exchangeRate),
      amountUsd: toStr(payment.amountUsd),
      cashAccountId: payment.cashAccountId,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      note: payment.note,
    })),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      units: item.units,
      kind: item.kind,
      unitPrice: toStr(item.unitPrice),
      unitCost: canSeeFinancials ? toStr(item.unitCost) : null,
      extraCost: canSeeFinancials ? toStr(item.extraCost) : null,
      lineTotal: toStr(item.lineTotal),
      lineCost: canSeeFinancials ? toStr(item.lineCost) : null,
      lineProfit: canSeeFinancials ? toStr(item.lineProfit) : null,
      product: {
        id: item.product.id,
        modelName: item.product.modelName,
        type: typeof item.product.type === "string" ? item.product.type.toUpperCase() : item.product.type,
        capacityGB: item.product.capacityGB,
        condition: item.product.condition,
        batteryPct: item.product.batteryPct,
        color: item.product.color,
        imei: item.product.imei,
        state: item.product.state,
        stock: item.product.stock,
        stockAvailable: item.product.stockAvailable,
        salePrice: toStr(item.product.salePrice),
      },
    })),
  }))

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Ventas" }]} />
      <div className="flex flex-col gap-4">
        <FilterableSalesTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}
