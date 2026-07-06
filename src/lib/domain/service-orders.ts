import { type ServiceOrderStatus, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { optionalDecimal } from "@/lib/domain/money"

export const serviceOrderSchema = z.object({
  type: z.enum(["STOCK", "CUSTOMER"]),
  productId: z.string().optional().nullable(),
  buyerId: z.string().optional().nullable(),
  modelName: z.string().trim().min(1),
  imeiSerial: z.string().optional().nullable(),
  failureDescription: z.string().trim().min(1),
  technicianId: z.string().optional().nullable(),
  costAmount: z.union([z.string(), z.number()]).optional().nullable(),
  priceAmount: z.union([z.string(), z.number()]).optional().nullable(),
  currency: z.enum(["ARS", "USD", "USDT"]).default("USD"),
  notes: z.string().optional().nullable(),
})

const transitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  RECEIVED: ["IN_WORKSHOP", "IN_PROGRESS", "CANCELLED"],
  IN_WORKSHOP: ["IN_PROGRESS", "WAITING_PARTS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "READY", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
}

export async function createServiceOrder(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  input: z.infer<typeof serviceOrderSchema>
}) {
  const input = serviceOrderSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    if (input.type === "STOCK" && !input.productId) throw new Error("Una orden STOCK requiere producto")
    if (input.type === "CUSTOMER" && !input.buyerId) throw new Error("Una orden CUSTOMER requiere comprador")

    if (input.productId) {
      const product = await tx.product.findFirst({ where: { id: input.productId, tenantId: params.tenantId }, select: { id: true } })
      if (!product) throw new Error("Producto no disponible")
    }
    if (input.buyerId) {
      const buyer = await tx.buyer.findFirst({ where: { id: input.buyerId, tenantId: params.tenantId }, select: { id: true } })
      if (!buyer) throw new Error("Comprador no disponible")
    }
    if (input.technicianId) {
      const user = await tx.user.findFirst({ where: { id: input.technicianId, tenantId: params.tenantId }, select: { id: true } })
      if (!user) throw new Error("Tecnico no disponible")
    }

    const order = await tx.serviceOrder.create({
      data: {
        tenantId: params.tenantId,
        type: input.type,
        productId: input.productId || null,
        buyerId: input.buyerId || null,
        modelName: input.modelName,
        imeiSerial: input.imeiSerial?.trim() || null,
        failureDescription: input.failureDescription,
        technicianId: input.technicianId || null,
        createdById: params.actorUserId,
        costAmount: optionalDecimal(input.costAmount),
        priceAmount: optionalDecimal(input.priceAmount),
        currency: input.currency,
        notes: input.notes?.trim() || null,
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "SERVICE",
      entityType: "ServiceOrder",
      entityId: order.id,
      detail: `Orden de servicio creada: ${order.modelName}`,
    }, tx)

    return order
  })
}

export async function transitionServiceOrder(params: {
  tenantId: string
  orderId: string
  status: ServiceOrderStatus
  actorUserId: string
  actorRole: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.serviceOrder.findFirst({ where: { id: params.orderId, tenantId: params.tenantId } })
    if (!current) throw new Error("Orden no encontrada")
    if (!transitions[current.status].includes(params.status)) throw new Error("Transicion de estado invalida")

    const now = new Date()
    const order = await tx.serviceOrder.update({
      where: { id: current.id },
      data: {
        status: params.status,
        ...(params.status === "IN_PROGRESS" ? { startedAt: current.startedAt ?? now } : {}),
        ...(params.status === "READY" ? { readyAt: now } : {}),
        ...(params.status === "DELIVERED" ? { deliveredAt: now } : {}),
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "STATUS_CHANGE",
      module: "SERVICE",
      entityType: "ServiceOrder",
      entityId: order.id,
      detail: `Orden de servicio cambio de ${current.status} a ${order.status}`,
    }, tx)
    return order
  })
}
