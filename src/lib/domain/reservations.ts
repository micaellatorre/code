import { Prisma, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { decimal, normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money"

const giftSchema = z.object({ label: z.string().trim().min(1) })

export const reservationPaymentSchema = z.object({
  method: z.string().min(1),
  currency: z.enum(["ARS", "USD", "USDT"]),
  amount: z.union([z.string(), z.number()]),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
  note: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
})

export const reservationItemSchema = z.object({
  productId: z.string().optional().nullable(),
  itemName: z.string().trim().min(1),
  imeiSerial: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.union([z.string(), z.number()]).optional().nullable(),
  gifts: z.array(giftSchema).optional().default([]),
})

export const reservationSchema = z.object({
  buyerId: z.string().optional().nullable(),
  reservedAt: z.string().optional().nullable(),
  pickupAt: z.string().optional().nullable(),
  agreedTotal: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(reservationItemSchema).min(1),
  payments: z.array(reservationPaymentSchema).optional().default([]),
})

function parseDate(value?: string | null) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Fecha invalida")
  return date
}

function paymentCreate(payment: z.infer<typeof reservationPaymentSchema>) {
  const amount = decimal(payment.amount)
  const exchangeRate = optionalDecimal(payment.exchangeRate)
  return {
    method: payment.method as any,
    currency: payment.currency,
    amount,
    exchangeRate,
    amountUsd: normalizeAmountUsd(amount, payment.currency, exchangeRate),
    note: payment.note?.trim() || null,
    paidAt: parseDate(payment.paidAt) ?? new Date(),
  }
}

async function recalcReservationTotals(tx: Prisma.TransactionClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: { payments: true },
  })
  if (!reservation) throw new Error("Reserva no encontrada")

  const amountPaid = reservation.payments.reduce((sum, payment) => {
    if (payment.amountUsd) return sum.add(payment.amountUsd)
    if (payment.currency === "USD") return sum.add(payment.amount)
    return sum
  }, new Prisma.Decimal(0))
  const agreedTotal = reservation.agreedTotal ?? new Prisma.Decimal(0)
  const balanceDue = agreedTotal.sub(amountPaid)

  return tx.reservation.update({
    where: { id: reservationId },
    data: { amountPaid, balanceDue },
    include: { items: true, payments: true, buyer: true },
  })
}

export async function createReservation(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  input: z.infer<typeof reservationSchema>
}) {
  const input = reservationSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    if (input.buyerId) {
      const buyer = await tx.buyer.findFirst({ where: { id: input.buyerId, tenantId: params.tenantId }, select: { id: true } })
      if (!buyer) throw new Error("Comprador no disponible")
    }

    const productIds = input.items.map((item) => item.productId).filter((id): id is string => Boolean(id))
    if (productIds.length) {
      const products = await tx.product.findMany({ where: { id: { in: productIds }, tenantId: params.tenantId }, select: { id: true } })
      if (products.length !== new Set(productIds).size) throw new Error("Uno o mas productos no pertenecen al tenant")
    }

    const reservedAt = parseDate(input.reservedAt) ?? new Date()
    const reservation = await tx.reservation.create({
      data: {
        tenantId: params.tenantId,
        buyerId: input.buyerId || null,
        userId: params.actorUserId,
        reservedAt,
        pickupAt: parseDate(input.pickupAt),
        agreedTotal: optionalDecimal(input.agreedTotal),
        notes: input.notes?.trim() || null,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId || null,
            itemName: item.itemName,
            imeiSerial: item.imeiSerial?.trim() || null,
            quantity: item.quantity,
            unitPrice: optionalDecimal(item.unitPrice),
            gifts: item.gifts,
          })),
        },
        payments: { create: input.payments.map(paymentCreate) },
      },
      include: { items: true },
    })

    for (const productId of productIds) {
      await tx.product.update({
        where: { id: productId },
        data: { senado: true, senadoAt: reservedAt },
      })
    }

    const updated = await recalcReservationTotals(tx, reservation.id)
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "RESERVATION_CREATED",
      module: "RESERVATION",
      entityType: "Reservation",
      entityId: reservation.id,
      detail: "Reserva creada",
      newValue: { id: reservation.id, items: reservation.items.length },
    }, tx)

    return updated
  })
}

export async function addReservationPayment(params: {
  tenantId: string
  reservationId: string
  actorUserId: string
  actorRole: UserRole
  input: z.infer<typeof reservationPaymentSchema>
}) {
  const input = reservationPaymentSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({ where: { id: params.reservationId, tenantId: params.tenantId }, select: { id: true, status: true } })
    if (!reservation) throw new Error("Reserva no encontrada")
    if (reservation.status !== "ACTIVE") throw new Error("Solo se pueden registrar pagos en reservas activas")

    const payment = await tx.reservationPayment.create({ data: { reservationId: reservation.id, ...paymentCreate(input) } })
    const updated = await recalcReservationTotals(tx, reservation.id)
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "PAYMENT_CREATED",
      module: "RESERVATION",
      entityType: "ReservationPayment",
      entityId: payment.id,
      detail: "Pago de reserva registrado",
    }, tx)
    return updated
  })
}

export async function cancelReservation(params: {
  tenantId: string
  reservationId: string
  actorUserId: string
  actorRole: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({
      where: { id: params.reservationId, tenantId: params.tenantId },
      include: { items: true },
    })
    if (!reservation) throw new Error("Reserva no encontrada")
    if (reservation.status !== "ACTIVE") throw new Error("La reserva no esta activa")

    const updated = await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED" } })
    const productIds = reservation.items.map((item) => item.productId).filter((id): id is string => Boolean(id))
    for (const productId of productIds) {
      const activeReservations = await tx.reservationItem.count({
        where: {
          productId,
          reservation: { tenantId: params.tenantId, status: "ACTIVE", id: { not: reservation.id } },
        },
      })
      if (activeReservations === 0) {
        await tx.product.update({ where: { id: productId }, data: { senado: false, senadoAt: null } })
      }
    }

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "RESERVATION_RELEASED",
      module: "RESERVATION",
      entityType: "Reservation",
      entityId: reservation.id,
      detail: "Reserva cancelada y productos liberados cuando correspondia",
    }, tx)

    return updated
  })
}

export async function convertReservationToSale(params: {
  tenantId: string
  reservationId: string
  actorUserId: string
  actorRole: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({
      where: { id: params.reservationId, tenantId: params.tenantId },
      include: { items: { include: { product: true } }, payments: true, buyer: true },
    })
    if (!reservation) throw new Error("Reserva no encontrada")
    if (reservation.status !== "ACTIVE") throw new Error("Solo se pueden convertir reservas activas")
    if (!reservation.items.every((item) => item.productId && item.product)) throw new Error("Todos los items deben tener producto para convertir")

    let subtotal = new Prisma.Decimal(0)
    let costTotal = new Prisma.Decimal(0)
    const itemCreates = reservation.items.map((item) => {
      const product = item.product!
      if (product.stockAvailable < item.quantity) throw new Error(`Stock insuficiente para ${product.modelName}`)
      const units = new Prisma.Decimal(item.quantity)
      const unitPrice = item.unitPrice ?? product.salePrice
      const lineTotal = unitPrice.mul(units)
      const lineCost = product.costPrice.mul(units)
      subtotal = subtotal.add(lineTotal)
      costTotal = costTotal.add(lineCost)
      return {
        productId: product.id,
        kind: "NORMAL" as const,
        units: item.quantity,
        unitPrice,
        unitCost: product.costPrice,
        extraCost: new Prisma.Decimal(0),
        lineTotal,
        lineCost,
        lineProfit: lineTotal.sub(lineCost),
      }
    })

    const amountPaid = reservation.payments.reduce((sum, payment) => {
      if (payment.amountUsd) return sum.add(payment.amountUsd)
      if (payment.currency === "USD") return sum.add(payment.amount)
      return sum
    }, new Prisma.Decimal(0))
    const total = reservation.agreedTotal ?? subtotal
    const profit = total.sub(costTotal)

    const sale = await tx.sale.create({
      data: {
        tenantId: params.tenantId,
        userId: params.actorUserId,
        buyerId: reservation.buyerId,
        customerName: reservation.buyer ? [reservation.buyer.name, reservation.buyer.surname].filter(Boolean).join(" ") : "Reserva",
        date: new Date(),
        status: "CONFIRMADA",
        saleType: reservation.buyer?.type ?? "MINORISTA",
        subtotal,
        extraCosts: new Prisma.Decimal(0),
        costTotal,
        total,
        profit,
        amountPaid,
        balanceDue: total.sub(amountPaid),
        notes: reservation.notes,
        items: { create: itemCreates },
        payments: {
          create: reservation.payments.map((payment) => ({
            method: payment.method,
            currency: payment.currency,
            amount: payment.amount,
            exchangeRate: payment.exchangeRate,
            amountUsd: payment.amountUsd,
            paidAt: payment.paidAt,
            note: payment.note,
          })),
        },
      },
    })

    for (const item of reservation.items) {
      await tx.product.update({
        where: { id: item.productId! },
        data: {
          stock: { decrement: item.quantity },
          stockAvailable: { decrement: item.quantity },
          senado: false,
          senadoAt: null,
        },
      })
    }

    await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CONVERTED", convertedSaleId: sale.id } })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CONVERSION",
      module: "RESERVATION",
      entityType: "Reservation",
      entityId: reservation.id,
      detail: `Reserva convertida en venta ${sale.id}`,
      metadata: { saleId: sale.id },
    }, tx)
    return sale
  })
}
