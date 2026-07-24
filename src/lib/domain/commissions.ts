import { Prisma, type CommissionStatus, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { decimal } from "@/lib/domain/money"
import { postCommissionPaymentToCash, reverseSourceCashMovement } from "@/lib/domain/cash"

export const commissionPlanSchema = z.object({
  name: z.string().trim().min(1),
  base: z.enum(["SALE_TOTAL", "SALE_PROFIT"]),
  ratePct: z.union([z.string(), z.number()]),
  isActive: z.boolean().optional(),
})

export const commissionSchema = z.object({
  saleId: z.string().min(1),
  closerId: z.string().min(1),
  planId: z.string().optional().nullable(),
  ratePct: z.union([z.string(), z.number()]).optional().nullable(),
})

export type CommissionPlanDto = {
  id: string
  name: string
  base: string
  ratePct: string
  isActive: boolean
}

export type CommissionSellerDto = {
  id: string
  name: string
  email: string
  isActive: boolean
  currentBranch: { id: string; code: string; name: string } | null
  salesCount: number
  commissionCount: number
  pendingAmount: string
  approvedAmount: string
  paidAmount: string
  cancelledAmount: string
  lastCommissionAt: string | null
}

export type SellerCommissionSaleDto = {
  id: string
  date: string
  status: string
  total: string
  profit: string
  branch: { id: string; code: string; name: string } | null
  hasCommission: boolean
}

export type SellerCommissionDto = {
  id: string
  saleId: string
  planName: string | null
  baseAmount: string
  ratePct: string
  amount: string
  currency: string
  status: string
  earnedAt: string
  paidAt: string | null
  notes: string | null
  sale: {
    id: string
    date: string
    total: string
    branch: { id: string; code: string; name: string } | null
  }
}

function planDto(plan: { id: string; name: string; base: string; ratePct: Prisma.Decimal | string | number; isActive: boolean }): CommissionPlanDto {
  return {
    id: plan.id,
    name: plan.name,
    base: plan.base,
    ratePct: String(plan.ratePct),
    isActive: plan.isActive,
  }
}

export async function listCommissionPlans(tenantId: string): Promise<CommissionPlanDto[]> {
  const plans = await prisma.closerCommissionPlan.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] })
  return plans.map(planDto)
}

export async function listCommissionSellers(tenantId: string): Promise<CommissionSellerDto[]> {
  const [sellers, groupedSales] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "VENDEDOR" },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        currentBranch: { select: { id: true, code: true, name: true } },
        closerCommissions: {
          select: { amount: true, status: true, earnedAt: true },
          orderBy: { earnedAt: "desc" },
        },
      },
    }),
    prisma.sale.groupBy({
      by: ["userId"],
      where: { tenantId, user: { is: { role: "VENDEDOR" } }, status: { not: "CANCELADA" } },
      _count: { _all: true },
    }),
  ])
  const salesCountByUser = new Map(groupedSales.map((row) => [row.userId, row._count._all]))

  return sellers.map((seller) => {
    const totals = seller.closerCommissions.reduce((acc, commission) => {
      const key = commission.status === "PENDING"
        ? "pendingAmount"
        : commission.status === "APPROVED"
          ? "approvedAmount"
          : commission.status === "PAID"
            ? "paidAmount"
            : "cancelledAmount"
      acc[key] = acc[key].add(commission.amount)
      return acc
    }, {
      pendingAmount: new Prisma.Decimal(0),
      approvedAmount: new Prisma.Decimal(0),
      paidAmount: new Prisma.Decimal(0),
      cancelledAmount: new Prisma.Decimal(0),
    })

    return {
      id: seller.id,
      name: seller.name ?? seller.email,
      email: seller.email,
      isActive: seller.isActive,
      currentBranch: seller.currentBranch,
      salesCount: salesCountByUser.get(seller.id) ?? 0,
      commissionCount: seller.closerCommissions.length,
      pendingAmount: totals.pendingAmount.toString(),
      approvedAmount: totals.approvedAmount.toString(),
      paidAmount: totals.paidAmount.toString(),
      cancelledAmount: totals.cancelledAmount.toString(),
      lastCommissionAt: seller.closerCommissions[0]?.earnedAt.toISOString() ?? null,
    }
  })
}

export async function getSellerCommissionWorkspace(params: { tenantId: string; sellerId: string }) {
  const [seller, plans, sales, commissions] = await Promise.all([
    prisma.user.findFirst({
      where: { id: params.sellerId, tenantId: params.tenantId, role: "VENDEDOR" },
      select: { id: true, name: true, email: true, isActive: true, currentBranch: { select: { id: true, code: true, name: true } } },
    }),
    prisma.closerCommissionPlan.findMany({ where: { tenantId: params.tenantId, isActive: true }, orderBy: [{ createdAt: "desc" }] }),
    prisma.sale.findMany({
      where: {
        tenantId: params.tenantId,
        userId: params.sellerId,
        status: { not: "CANCELADA" },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        total: true,
        profit: true,
        branch: { select: { id: true, code: true, name: true } },
        closerCommissions: { select: { id: true } },
      },
    }),
    prisma.closerCommission.findMany({
      where: { tenantId: params.tenantId, closerId: params.sellerId },
      orderBy: { earnedAt: "desc" },
      include: {
        plan: { select: { name: true } },
        sale: { select: { id: true, date: true, total: true, branch: { select: { id: true, code: true, name: true } } } },
      },
    }),
  ])

  if (!seller) return null

  return {
    seller,
    plans: plans.map(planDto),
    sales: sales.map((sale): SellerCommissionSaleDto => ({
      id: sale.id,
      date: sale.date.toISOString(),
      status: sale.status,
      total: sale.total.toString(),
      profit: sale.profit.toString(),
      branch: sale.branch,
      hasCommission: sale.closerCommissions.length > 0,
    })),
    commissions: commissions.map((commission): SellerCommissionDto => ({
      id: commission.id,
      saleId: commission.saleId,
      planName: commission.plan?.name ?? null,
      baseAmount: commission.baseAmount.toString(),
      ratePct: commission.ratePct.toString(),
      amount: commission.amount.toString(),
      currency: commission.currency,
      status: commission.status,
      earnedAt: commission.earnedAt.toISOString(),
      paidAt: commission.paidAt?.toISOString() ?? null,
      notes: commission.notes,
      sale: {
        id: commission.sale.id,
        date: commission.sale.date.toISOString(),
        total: commission.sale.total.toString(),
        branch: commission.sale.branch,
      },
    })),
  }
}

export async function createCommissionPlan(params: { tenantId: string; actorUserId: string; actorRole: UserRole; input: z.infer<typeof commissionPlanSchema> }) {
  const input = commissionPlanSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const plan = await tx.closerCommissionPlan.create({ data: { tenantId: params.tenantId, name: input.name, base: input.base, ratePct: decimal(input.ratePct), isActive: input.isActive ?? true } })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "CREATE", module: "COMMISSION", entityType: "CloserCommissionPlan", entityId: plan.id, detail: `Plan de comision creado: ${plan.name}` }, tx)
    return plan
  })
}

export async function createCommission(params: { tenantId: string; actorUserId: string; actorRole: UserRole; input: z.infer<typeof commissionSchema> }) {
  const input = commissionSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: input.saleId, tenantId: params.tenantId }, select: { id: true, total: true, profit: true } })
    if (!sale) throw new Error("Venta no disponible")
    const closer = await tx.user.findFirst({ where: { id: input.closerId, tenantId: params.tenantId, role: "VENDEDOR", isActive: true }, select: { id: true } })
    if (!closer) throw new Error("Closer no disponible. Debe ser un usuario vendedor activo.")
    const plan = input.planId ? await tx.closerCommissionPlan.findFirst({ where: { id: input.planId, tenantId: params.tenantId, isActive: true } }) : null
    const base = plan?.base ?? "SALE_PROFIT"
    const ratePct = input.ratePct != null ? decimal(input.ratePct) : (plan?.ratePct ?? new Prisma.Decimal(0))
    if (ratePct.lessThan(0) || ratePct.greaterThan(100)) throw new Error("Porcentaje invalido")
    const baseAmount = base === "SALE_TOTAL" ? sale.total : sale.profit
    const amount = baseAmount.mul(ratePct).div(100)
    const commission = await tx.closerCommission.create({
      data: { tenantId: params.tenantId, saleId: sale.id, closerId: closer.id, planId: plan?.id ?? null, baseAmount, ratePct, amount, currency: "USD" },
    })
    await tx.sale.update({ where: { id: sale.id }, data: { closerId: closer.id } })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "CREATE", module: "COMMISSION", entityType: "CloserCommission", entityId: commission.id, detail: "Comision generada" }, tx)
    return commission
  })
}

export async function updateCommissionStatus(params: {
  tenantId: string
  commissionId: string
  status: CommissionStatus
  actorUserId: string
  actorRole: UserRole
  cashAccountId?: string | null
  paidAt?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.closerCommission.findFirst({
      where: { id: params.commissionId, tenantId: params.tenantId },
      include: { sale: { select: { id: true, branchId: true } } },
    })
    if (!current) throw new Error("Comision no encontrada")
    const paidAt = params.paidAt ? new Date(params.paidAt) : new Date()
    if (params.paidAt && Number.isNaN(paidAt.getTime())) throw new Error("Fecha de pago invalida")
    if (params.status === "PAID" && !params.cashAccountId && !current.cashAccountId) {
      throw new Error("Selecciona una caja para pagar la comision.")
    }
    const commission = await tx.closerCommission.update({
      where: { id: current.id },
      data: {
        status: params.status,
        paidAt: params.status === "PAID" ? paidAt : current.paidAt,
        cashAccountId: params.status === "PAID" ? params.cashAccountId || current.cashAccountId : current.cashAccountId,
      },
    })
    if (params.status === "PAID") {
      await postCommissionPaymentToCash({
        tx,
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        commission: {
          id: commission.id,
          saleId: commission.saleId,
          branchId: current.sale.branchId,
          amount: commission.amount,
          currency: commission.currency,
          paidAt: commission.paidAt ?? paidAt,
          cashAccountId: commission.cashAccountId,
        },
      })
    } else if (current.status === "PAID") {
      await reverseSourceCashMovement({
        tx,
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        sourceType: "CLOSER_COMMISSION",
        sourceId: current.id,
        reason: `Comision ${current.id} cambio de PAID a ${params.status}`,
      })
    }
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "STATUS_CHANGE", module: "COMMISSION", entityType: "CloserCommission", entityId: commission.id, detail: `Comision ${current.status} -> ${commission.status}` }, tx)
    return commission
  })
}
