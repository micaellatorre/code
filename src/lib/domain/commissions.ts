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
    const closer = await tx.user.findFirst({ where: { id: input.closerId, tenantId: params.tenantId }, select: { id: true } })
    if (!closer) throw new Error("Closer no disponible")
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
