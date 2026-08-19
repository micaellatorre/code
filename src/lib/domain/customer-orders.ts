import { randomUUID } from "crypto"
import { Prisma, type Currency, type PaymentMethod, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { assertCashBusinessDateOpen, isMonetaryPaymentMethod } from "@/lib/domain/cash"

type Tx = Prisma.TransactionClient

export type CustomerOrderStatus =
  | "CONFIRMED"
  | "PROCUREMENT_PENDING"
  | "ORDERED_TO_SUPPLIER"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "READY_FOR_DELIVERY"
  | "CONVERTED"
  | "CANCELLED"

export type CustomerOrderSource = "INTERNAL" | "INSTAGRAM" | "OFFICE" | "ECOMMERCE" | "WHATSAPP" | "OTHER"
export type CustomerOrderItemKind = "STOCK" | "ON_DEMAND"

type Actor = { tenantId: string; actorUserId: string; actorRole: UserRole | string }

export type PricedOrderPayment = {
  method: PaymentMethod
  currency: Currency
  amount: Prisma.Decimal
  exchangeRate: Prisma.Decimal | null
  amountUsd: Prisma.Decimal | null
  coveredBaseUsd: Prisma.Decimal
  surchargePct: Prisma.Decimal
  surchargeAmount: Prisma.Decimal
  installments: number | null
  installmentAmount: Prisma.Decimal | null
  pricingSnapshot: Prisma.InputJsonValue | null
  cashAccountId?: string | null
  paidAt?: Date
  note?: string | null
}

export type CreateCustomerOrderInput = {
  buyerId: string
  branchId: string
  assignedSellerId?: string | null
  appointmentId?: string | null
  source?: CustomerOrderSource
  estimatedDeliveryAt?: Date | null
  notes?: string | null
  items: Array<{
    kind: CustomerOrderItemKind
    stockProductId?: string | null
    catalogModelId?: string | null
    catalogCapacityId?: string | null
    catalogColorId?: string | null
    description: string
    modelName?: string | null
    capacityGB?: number | null
    color?: string | null
    condition?: string | null
    quantity: number
    unitPriceUsd: Prisma.Decimal
    unitCostUsd?: Prisma.Decimal | null
    notes?: string | null
  }>
  payments: PricedOrderPayment[]
}

type OrderHeaderRow = {
  id: string
  orderNumber: number
  tenantId: string
  buyerId: string
  createdById: string | null
  assignedSellerId: string | null
  appointmentId: string | null
  branchId: string
  convertedSaleId: string | null
  status: CustomerOrderStatus
  source: CustomerOrderSource
  requestedAt: Date
  estimatedDeliveryAt: Date | null
  agreedTotalUsd: Prisma.Decimal
  amountPaidUsd: Prisma.Decimal
  balanceDueUsd: Prisma.Decimal
  notes: string | null
  customerNameSnapshot: string | null
  customerDocumentSnapshot: string | null
  customerPhoneSnapshot: string | null
  customerEmailSnapshot: string | null
  deliveryDisclaimerSnapshot: string | null
  cancelledAt: Date | null
  convertedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CustomerOrderView = OrderHeaderRow & {
  buyer: { id: string; name: string; surname: string | null; dni: string | null; phone: string | null; email: string | null } | null
  createdBy: { id: string; name: string | null; email: string } | null
  assignedSeller: { id: string; name: string | null; email: string } | null
  branch: { id: string; code: string; name: string } | null
  items: any[]
  payments: any[]
  allocations: any[]
}

const allowedTransitions: Record<CustomerOrderStatus, CustomerOrderStatus[]> = {
  CONFIRMED: ["PROCUREMENT_PENDING", "ORDERED_TO_SUPPLIER", "CANCELLED"],
  PROCUREMENT_PENDING: ["ORDERED_TO_SUPPLIER", "CANCELLED"],
  ORDERED_TO_SUPPLIER: ["IN_TRANSIT", "RECEIVED", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["CONVERTED", "CANCELLED"],
  CONVERTED: [],
  CANCELLED: [],
}

function usd(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

async function rawSettings(tenantId: string, tx: Tx = prisma) {
  const rows = await tx.$queryRaw<Array<{
    customerOrderMinimumDepositUsd: Prisma.Decimal
    customerOrderDefaultDeliveryDays: number
    customerOrderDeliveryDisclaimer: string
  }>>(Prisma.sql`
    SELECT
      "customerOrderMinimumDepositUsd",
      "customerOrderDefaultDeliveryDays",
      "customerOrderDeliveryDisclaimer"
    FROM "TenantSettings"
    WHERE "tenantId" = ${tenantId}
    LIMIT 1
  `)
  return rows[0] ?? {
    customerOrderMinimumDepositUsd: new Prisma.Decimal(100),
    customerOrderDefaultDeliveryDays: 7,
    customerOrderDeliveryDisclaimer: "Fecha de entrega estimada. Puede presentar demoras por logística, disponibilidad de proveedor o causas ajenas al negocio.",
  }
}

async function auditOrder(tx: Tx, params: Actor & { action: string; orderId: string; detail: string; metadata?: Prisma.InputJsonValue }) {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "AuditLog" (
      "id", "tenantId", "actorUserId", "actorRole", "executedByAdminInSimulation", "action", "module",
      "entityType", "entityId", "detail", "metadata", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${params.tenantId}, ${params.actorUserId}, ${params.actorRole}::"UserRole", false,
      ${params.action}::"AuditAction", 'ORDER'::"AuditModule", 'CustomerOrder', ${params.orderId}, ${params.detail},
      ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb, NOW()
    )
  `)
}

async function postOrderPaymentToCash(tx: Tx, params: Actor & {
  orderId: string
  branchId: string
  paymentId: string
  payment: PricedOrderPayment
}) {
  if (!isMonetaryPaymentMethod(params.payment.method)) return
  if (!params.payment.cashAccountId) throw new Error("Selecciona una caja para registrar el pago del pedido.")
  const paidAt = params.payment.paidAt ?? new Date()
  await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: params.branchId, date: paidAt }, tx)
  const account = await tx.cashAccount.findFirst({
    where: {
      id: params.payment.cashAccountId,
      tenantId: params.tenantId,
      isActive: true,
      currency: params.payment.currency,
      OR: [{ scope: "TENANT" }, { scope: "BRANCH", branchId: params.branchId }],
    },
    select: { id: true },
  })
  if (!account) throw new Error("Cuenta de caja no disponible para la sucursal o moneda del pedido.")
  const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT cm."id"
    FROM "CashMovement" cm
    LEFT JOIN "CashMovement" rev ON rev."reversalOfId" = cm."id"
    WHERE cm."tenantId" = ${params.tenantId}
      AND cm."sourceType" = 'CUSTOMER_ORDER_PAYMENT'::"CashMovementSource"
      AND cm."sourceId" = ${params.paymentId}
      AND rev."id" IS NULL
    LIMIT 1
  `)
  if (existing[0]) return
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "CashMovement" (
      "id", "tenantId", "accountId", "branchId", "userId", "direction", "category", "detail",
      "amount", "currency", "exchangeRate", "amountUsd", "sourceType", "sourceId", "occurredAt", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${params.tenantId}, ${account.id}, ${params.branchId}, ${params.actorUserId},
      'INCOME'::"CashMovementDirection", 'CUSTOMER_ORDER_PAYMENT'::"CashMovementCategory",
      ${`Pago de pedido ${params.orderId}`}, ${params.payment.amount}, ${params.payment.currency}::"Currency",
      ${params.payment.exchangeRate}, ${params.payment.amountUsd}, 'CUSTOMER_ORDER_PAYMENT'::"CashMovementSource",
      ${params.paymentId}, ${paidAt}, NOW()
    )
  `)
}

async function reverseOrderCashPayments(tx: Tx, params: Actor & { orderId: string }) {
  const movements = await tx.$queryRaw<Array<{
    id: string
    accountId: string
    branchId: string | null
    amount: Prisma.Decimal
    currency: Currency
    exchangeRate: Prisma.Decimal | null
    amountUsd: Prisma.Decimal | null
    sourceId: string | null
  }>>(Prisma.sql`
    SELECT cm."id", cm."accountId", cm."branchId", cm."amount", cm."currency", cm."exchangeRate", cm."amountUsd", cm."sourceId"
    FROM "CashMovement" cm
    JOIN "CustomerOrderPayment" op ON op."id" = cm."sourceId"
    LEFT JOIN "CashMovement" rev ON rev."reversalOfId" = cm."id"
    WHERE op."orderId" = ${params.orderId}
      AND cm."tenantId" = ${params.tenantId}
      AND cm."sourceType" = 'CUSTOMER_ORDER_PAYMENT'::"CashMovementSource"
      AND rev."id" IS NULL
  `)
  for (const movement of movements) {
    if (movement.branchId) {
      await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: movement.branchId, date: new Date() }, tx)
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CashMovement" (
        "id", "tenantId", "accountId", "branchId", "userId", "direction", "category", "detail",
        "amount", "currency", "exchangeRate", "amountUsd", "sourceType", "sourceId", "reversalOfId", "occurredAt", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${params.tenantId}, ${movement.accountId}, ${movement.branchId}, ${params.actorUserId},
        'EXPENSE'::"CashMovementDirection", 'REVERSAL'::"CashMovementCategory", ${`Reversa por cancelación de pedido ${params.orderId}`},
        ${movement.amount}, ${movement.currency}::"Currency", ${movement.exchangeRate}, ${movement.amountUsd},
        'MANUAL'::"CashMovementSource", ${`order-cancel:${movement.id}`}, ${movement.id}, NOW(), NOW()
      )
    `)
  }
}

async function getOrderHeader(orderId: string, tenantId: string, tx: Tx = prisma) {
  const rows = await tx.$queryRaw<OrderHeaderRow[]>(Prisma.sql`
    SELECT * FROM "CustomerOrder" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} LIMIT 1
  `)
  return rows[0] ?? null
}

export async function listCustomerOrders(tenantId: string): Promise<CustomerOrderView[]> {
  const headers = await prisma.$queryRaw<OrderHeaderRow[]>(Prisma.sql`
    SELECT * FROM "CustomerOrder" WHERE "tenantId" = ${tenantId} ORDER BY "requestedAt" DESC
  `)
  return Promise.all(headers.map((header) => getCustomerOrder(tenantId, header.id).then((order) => order as CustomerOrderView)))
}

export async function getCustomerOrder(tenantId: string, orderId: string): Promise<CustomerOrderView | null> {
  const header = await getOrderHeader(orderId, tenantId)
  if (!header) return null
  const [buyer, createdBy, assignedSeller, branch, items, payments, allocations] = await Promise.all([
    prisma.buyer.findFirst({ where: { id: header.buyerId, tenantId }, select: { id: true, name: true, surname: true, dni: true, phone: true, email: true } }),
    header.createdById ? prisma.user.findFirst({ where: { id: header.createdById, tenantId }, select: { id: true, name: true, email: true } }) : null,
    header.assignedSellerId ? prisma.user.findFirst({ where: { id: header.assignedSellerId, tenantId }, select: { id: true, name: true, email: true } }) : null,
    prisma.branch.findFirst({ where: { id: header.branchId, tenantId }, select: { id: true, code: true, name: true } }),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "CustomerOrderItem" WHERE "orderId" = ${orderId} ORDER BY "createdAt" ASC`),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "CustomerOrderPayment" WHERE "orderId" = ${orderId} ORDER BY "paidAt" ASC`),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "CustomerOrderInventoryAllocation" WHERE "orderId" = ${orderId} ORDER BY "reservedAt" ASC`),
  ])
  return { ...header, buyer, createdBy, assignedSeller, branch, items, payments, allocations }
}

export async function createCustomerOrder(params: Actor & { input: CreateCustomerOrderInput }) {
  if (!params.input.items.length) throw new Error("El pedido debe tener al menos un ítem.")
  const settings = await rawSettings(params.tenantId)
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.input.buyerId, tenantId: params.tenantId },
    select: { id: true, name: true, surname: true, dni: true, phone: true, email: true },
  })
  if (!buyer) throw new Error("Cliente no encontrado.")
  if (!buyer.surname || !buyer.dni || !buyer.phone || !buyer.email) {
    throw new Error("Para crear un pedido el cliente debe tener apellido, DNI, teléfono y email.")
  }
  const branch = await prisma.branch.findFirst({ where: { id: params.input.branchId, tenantId: params.tenantId, isActive: true }, select: { id: true } })
  if (!branch) throw new Error("Sucursal no disponible.")
  if (params.input.assignedSellerId) {
    const seller = await prisma.user.findFirst({ where: { id: params.input.assignedSellerId, tenantId: params.tenantId, isActive: true, role: { in: ["ADMIN", "VENDEDOR"] } }, select: { id: true } })
    if (!seller) throw new Error("Vendedor asignado no disponible.")
  }
  if (params.input.appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: params.input.appointmentId, buyerId: buyer.id }, select: { id: true } })
    if (!appointment) throw new Error("La cita no corresponde al cliente del pedido.")
  }
  const total = params.input.items.reduce((sum, item) => sum.add(usd(item.unitPriceUsd).mul(item.quantity)), new Prisma.Decimal(0)).toDecimalPlaces(2)
  if (total.lessThanOrEqualTo(0)) throw new Error("El total del pedido debe ser mayor a cero.")
  const paid = params.input.payments.reduce((sum, payment) => sum.add(payment.coveredBaseUsd), new Prisma.Decimal(0)).toDecimalPlaces(2)
  if (paid.greaterThan(total)) throw new Error("Los pagos no pueden cubrir más que el total del pedido.")
  if (paid.lessThan(settings.customerOrderMinimumDepositUsd) && !paid.equals(total)) {
    throw new Error(`La seña mínima para confirmar el pedido es USD ${settings.customerOrderMinimumDepositUsd.toFixed(2)}.`)
  }
  const estimatedDeliveryAt = params.input.estimatedDeliveryAt ?? new Date(Date.now() + settings.customerOrderDefaultDeliveryDays * 86400000)
  const orderId = randomUUID()

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CustomerOrder" (
        "id", "tenantId", "buyerId", "createdById", "assignedSellerId", "appointmentId", "branchId", "status", "source",
        "requestedAt", "estimatedDeliveryAt", "agreedTotalUsd", "amountPaidUsd", "balanceDueUsd", "notes",
        "customerNameSnapshot", "customerDocumentSnapshot", "customerPhoneSnapshot", "customerEmailSnapshot", "deliveryDisclaimerSnapshot",
        "createdAt", "updatedAt"
      ) VALUES (
        ${orderId}, ${params.tenantId}, ${buyer.id}, ${params.actorUserId}, ${params.input.assignedSellerId ?? params.actorUserId},
        ${params.input.appointmentId ?? null}, ${branch.id}, 'CONFIRMED'::"CustomerOrderStatus", ${params.input.source ?? "INTERNAL"}::"CustomerOrderSource",
        NOW(), ${estimatedDeliveryAt}, ${total}, ${paid}, ${total.sub(paid)}, ${params.input.notes ?? null},
        ${`${buyer.name} ${buyer.surname}`.trim()}, ${buyer.dni}, ${buyer.phone}, ${buyer.email}, ${settings.customerOrderDeliveryDisclaimer},
        NOW(), NOW()
      )
    `)

    for (const item of params.input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("La cantidad de cada ítem debe ser un entero positivo.")
      const itemId = randomUUID()
      let unitCost = item.unitCostUsd ?? null
      let fulfilledProductId: string | null = null
      if (item.kind === "STOCK") {
        if (!item.stockProductId) throw new Error("Los ítems de stock requieren producto.")
        const product = await tx.product.findFirst({ where: { id: item.stockProductId, tenantId: params.tenantId }, select: { id: true, branchId: true, costPrice: true, stockAvailable: true } })
        if (!product || product.branchId !== branch.id) throw new Error(`Producto de stock no disponible en la sucursal: ${item.description}`)
        const reserved = await tx.product.updateMany({
          where: { id: product.id, tenantId: params.tenantId, stockAvailable: { gte: item.quantity } },
          data: { stockAvailable: { decrement: item.quantity } },
        })
        if (reserved.count !== 1) throw new Error(`Stock insuficiente para reservar: ${item.description}`)
        unitCost = product.costPrice
        fulfilledProductId = product.id
      }
      const lineTotal = usd(item.unitPriceUsd).mul(item.quantity).toDecimalPlaces(2)
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "CustomerOrderItem" (
          "id", "orderId", "kind", "stockProductId", "fulfilledProductId", "catalogModelId", "catalogCapacityId", "catalogColorId",
          "descriptionSnapshot", "modelNameSnapshot", "capacityGBSnapshot", "colorSnapshot", "conditionSnapshot", "quantity",
          "unitPriceUsd", "unitCostUsd", "lineTotalUsd", "notes", "createdAt", "updatedAt"
        ) VALUES (
          ${itemId}, ${orderId}, ${item.kind}::"CustomerOrderItemKind", ${item.stockProductId ?? null}, ${fulfilledProductId},
          ${item.catalogModelId ?? null}, ${item.catalogCapacityId ?? null}, ${item.catalogColorId ?? null}, ${item.description},
          ${item.modelName ?? null}, ${item.capacityGB ?? null}, ${item.color ?? null}, ${item.condition ?? null}::"Condition",
          ${item.quantity}, ${usd(item.unitPriceUsd)}, ${unitCost}, ${lineTotal}, ${item.notes ?? null}, NOW(), NOW()
        )
      `)
      if (fulfilledProductId) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "CustomerOrderInventoryAllocation" (
            "id", "orderId", "itemId", "productId", "quantity", "status", "reservedAt", "createdAt"
          ) VALUES (${randomUUID()}, ${orderId}, ${itemId}, ${fulfilledProductId}, ${item.quantity}, 'ACTIVE'::"CustomerOrderAllocationStatus", NOW(), NOW())
        `)
      }
    }

    for (const payment of params.input.payments) {
      const paymentId = randomUUID()
      const paidAt = payment.paidAt ?? new Date()
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "CustomerOrderPayment" (
          "id", "orderId", "method", "currency", "amount", "exchangeRate", "amountUsd", "coveredBaseUsd", "surchargePct",
          "surchargeAmount", "installments", "installmentAmount", "pricingSnapshot", "cashAccountId", "paidAt", "note", "createdAt"
        ) VALUES (
          ${paymentId}, ${orderId}, ${payment.method}::"PaymentMethod", ${payment.currency}::"Currency", ${payment.amount}, ${payment.exchangeRate},
          ${payment.amountUsd}, ${payment.coveredBaseUsd}, ${payment.surchargePct}, ${payment.surchargeAmount}, ${payment.installments}, ${payment.installmentAmount},
          ${payment.pricingSnapshot ? JSON.stringify(payment.pricingSnapshot) : null}::jsonb, ${payment.cashAccountId ?? null}, ${paidAt}, ${payment.note ?? null}, NOW()
        )
      `)
      await postOrderPaymentToCash(tx, { ...params, orderId, branchId: branch.id, paymentId, payment: { ...payment, paidAt } })
    }
    await auditOrder(tx, { ...params, action: "ORDER_CREATED", orderId, detail: `Pedido #${orderId} creado`, metadata: { totalUsd: total.toString(), amountPaidUsd: paid.toString() } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  return getCustomerOrder(params.tenantId, orderId)
}

export async function addCustomerOrderPayment(params: Actor & { orderId: string; payment: PricedOrderPayment }) {
  return prisma.$transaction(async (tx) => {
    const order = await getOrderHeader(params.orderId, params.tenantId, tx)
    if (!order) throw new Error("Pedido no encontrado.")
    if (["CANCELLED", "CONVERTED"].includes(order.status)) throw new Error("El pedido ya no acepta pagos.")
    const nextPaid = order.amountPaidUsd.add(params.payment.coveredBaseUsd).toDecimalPlaces(2)
    if (nextPaid.greaterThan(order.agreedTotalUsd)) throw new Error("El pago supera el saldo pendiente del pedido.")
    const paymentId = randomUUID()
    const paidAt = params.payment.paidAt ?? new Date()
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CustomerOrderPayment" (
        "id", "orderId", "method", "currency", "amount", "exchangeRate", "amountUsd", "coveredBaseUsd", "surchargePct",
        "surchargeAmount", "installments", "installmentAmount", "pricingSnapshot", "cashAccountId", "paidAt", "note", "createdAt"
      ) VALUES (
        ${paymentId}, ${order.id}, ${params.payment.method}::"PaymentMethod", ${params.payment.currency}::"Currency", ${params.payment.amount},
        ${params.payment.exchangeRate}, ${params.payment.amountUsd}, ${params.payment.coveredBaseUsd}, ${params.payment.surchargePct}, ${params.payment.surchargeAmount},
        ${params.payment.installments}, ${params.payment.installmentAmount}, ${params.payment.pricingSnapshot ? JSON.stringify(params.payment.pricingSnapshot) : null}::jsonb,
        ${params.payment.cashAccountId ?? null}, ${paidAt}, ${params.payment.note ?? null}, NOW()
      )
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE "CustomerOrder" SET "amountPaidUsd" = ${nextPaid}, "balanceDueUsd" = ${order.agreedTotalUsd.sub(nextPaid)}, "updatedAt" = NOW()
      WHERE "id" = ${order.id}
    `)
    await postOrderPaymentToCash(tx, { ...params, orderId: order.id, branchId: order.branchId, paymentId, payment: { ...params.payment, paidAt } })
    return { paymentId, amountPaidUsd: nextPaid, balanceDueUsd: order.agreedTotalUsd.sub(nextPaid) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function assignOrderItemProduct(params: Actor & { orderId: string; itemId: string; productId: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await getOrderHeader(params.orderId, params.tenantId, tx)
    if (!order) throw new Error("Pedido no encontrado.")
    if (["CANCELLED", "CONVERTED"].includes(order.status)) throw new Error("El pedido ya no admite asignaciones.")
    const items = await tx.$queryRaw<Array<{ id: string; kind: CustomerOrderItemKind; quantity: number; fulfilledProductId: string | null }>>(Prisma.sql`
      SELECT "id", "kind", "quantity", "fulfilledProductId" FROM "CustomerOrderItem" WHERE "id" = ${params.itemId} AND "orderId" = ${order.id} LIMIT 1
    `)
    const item = items[0]
    if (!item) throw new Error("Ítem de pedido no encontrado.")
    if (item.fulfilledProductId) throw new Error("El ítem ya tiene producto asignado.")
    const product = await tx.product.findFirst({ where: { id: params.productId, tenantId: params.tenantId }, select: { id: true, branchId: true, costPrice: true } })
    if (!product || product.branchId !== order.branchId) throw new Error("Producto no disponible en la sucursal del pedido.")
    const reserved = await tx.product.updateMany({ where: { id: product.id, tenantId: params.tenantId, stockAvailable: { gte: item.quantity } }, data: { stockAvailable: { decrement: item.quantity } } })
    if (reserved.count !== 1) throw new Error("Stock disponible insuficiente para asignar el producto.")
    await tx.$executeRaw(Prisma.sql`
      UPDATE "CustomerOrderItem" SET "fulfilledProductId" = ${product.id}, "unitCostUsd" = ${product.costPrice}, "updatedAt" = NOW() WHERE "id" = ${item.id}
    `)
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CustomerOrderInventoryAllocation" ("id", "orderId", "itemId", "productId", "quantity", "status", "reservedAt", "createdAt")
      VALUES (${randomUUID()}, ${order.id}, ${item.id}, ${product.id}, ${item.quantity}, 'ACTIVE'::"CustomerOrderAllocationStatus", NOW(), NOW())
    `)
    await auditOrder(tx, { ...params, action: "ORDER_ITEM_ALLOCATED", orderId: order.id, detail: `Producto asignado al ítem ${item.id}`, metadata: { itemId: item.id, productId: product.id } })
    return { itemId: item.id, productId: product.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function transitionCustomerOrder(params: Actor & { orderId: string; status: CustomerOrderStatus }) {
  if (params.status === "CONVERTED") throw new Error("Usa la acción de conversión para finalizar el pedido.")
  return prisma.$transaction(async (tx) => {
    const order = await getOrderHeader(params.orderId, params.tenantId, tx)
    if (!order) throw new Error("Pedido no encontrado.")
    if (!allowedTransitions[order.status].includes(params.status)) throw new Error(`Transición inválida: ${order.status} → ${params.status}.`)
    if (params.status === "READY_FOR_DELIVERY") {
      const missing = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "CustomerOrderItem" WHERE "orderId" = ${order.id} AND "fulfilledProductId" IS NULL
      `)
      if (Number(missing[0]?.count ?? 0) > 0) throw new Error("Todos los ítems deben tener producto asignado antes de marcar el pedido listo para entregar.")
    }
    if (params.status === "CANCELLED") {
      const allocations = await tx.$queryRaw<Array<{ id: string; productId: string; quantity: number }>>(Prisma.sql`
        SELECT "id", "productId", "quantity" FROM "CustomerOrderInventoryAllocation" WHERE "orderId" = ${order.id} AND "status" = 'ACTIVE'::"CustomerOrderAllocationStatus"
      `)
      for (const allocation of allocations) {
        await tx.product.update({ where: { id: allocation.productId }, data: { stockAvailable: { increment: allocation.quantity } } })
      }
      await tx.$executeRaw(Prisma.sql`
        UPDATE "CustomerOrderInventoryAllocation" SET "status" = 'RELEASED'::"CustomerOrderAllocationStatus", "releasedAt" = NOW()
        WHERE "orderId" = ${order.id} AND "status" = 'ACTIVE'::"CustomerOrderAllocationStatus"
      `)
      await reverseOrderCashPayments(tx, { ...params, orderId: order.id })
    }
    await tx.$executeRaw(Prisma.sql`
      UPDATE "CustomerOrder"
      SET "status" = ${params.status}::"CustomerOrderStatus", "cancelledAt" = CASE WHEN ${params.status} = 'CANCELLED' THEN NOW() ELSE "cancelledAt" END, "updatedAt" = NOW()
      WHERE "id" = ${order.id}
    `)
    await auditOrder(tx, {
      ...params,
      action: params.status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_STATUS_CHANGE",
      orderId: order.id,
      detail: `Pedido ${order.status} → ${params.status}`,
      metadata: { from: order.status, to: params.status },
    })
    return { id: order.id, status: params.status }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function convertCustomerOrderToSale(params: Actor & { orderId: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await getOrderHeader(params.orderId, params.tenantId, tx)
    if (!order) throw new Error("Pedido no encontrado.")
    if (order.convertedSaleId) return { saleId: order.convertedSaleId, alreadyConverted: true }
    if (order.status !== "READY_FOR_DELIVERY") throw new Error("El pedido debe estar listo para entregar antes de convertirlo en venta.")
    if (order.balanceDueUsd.greaterThan(0)) throw new Error("El pedido debe estar totalmente pagado antes de convertirlo en venta.")
    const items = await tx.$queryRaw<Array<{
      id: string
      fulfilledProductId: string | null
      quantity: number
      unitPriceUsd: Prisma.Decimal
      unitCostUsd: Prisma.Decimal | null
    }>>(Prisma.sql`SELECT "id", "fulfilledProductId", "quantity", "unitPriceUsd", "unitCostUsd" FROM "CustomerOrderItem" WHERE "orderId" = ${order.id} ORDER BY "createdAt" ASC`)
    if (!items.length || items.some((item) => !item.fulfilledProductId)) throw new Error("Todos los ítems deben tener producto asignado.")
    const allocations = await tx.$queryRaw<Array<{ itemId: string; productId: string; quantity: number }>>(Prisma.sql`
      SELECT "itemId", "productId", "quantity" FROM "CustomerOrderInventoryAllocation" WHERE "orderId" = ${order.id} AND "status" = 'ACTIVE'::"CustomerOrderAllocationStatus"
    `)
    if (allocations.length !== items.length) throw new Error("El pedido no tiene todas las reservas de inventario activas.")
    const products = await tx.product.findMany({ where: { id: { in: items.map((item) => item.fulfilledProductId as string) }, tenantId: params.tenantId }, select: { id: true, stock: true, costPrice: true } })
    const productMap = new Map(products.map((product) => [product.id, product]))
    for (const allocation of allocations) {
      const product = productMap.get(allocation.productId)
      if (!product || product.stock < allocation.quantity) throw new Error("Stock físico insuficiente para entregar uno de los ítems.")
    }
    const costTotal = items.reduce((sum, item) => {
      const product = productMap.get(item.fulfilledProductId as string)
      return sum.add((product?.costPrice ?? item.unitCostUsd ?? new Prisma.Decimal(0)).mul(item.quantity))
    }, new Prisma.Decimal(0)).toDecimalPlaces(2)
    const sale = await tx.sale.create({
      data: {
        tenantId: params.tenantId,
        userId: params.actorUserId,
        branchId: order.branchId,
        buyerId: order.buyerId,
        date: new Date(),
        origin: `Pedido #${order.orderNumber}`,
        notes: order.notes,
        status: "CONFIRMADA",
        amountPaid: order.amountPaidUsd,
        balanceDue: new Prisma.Decimal(0),
        subtotal: order.agreedTotalUsd,
        costTotal,
        extraCosts: new Prisma.Decimal(0),
        total: order.agreedTotalUsd,
        profit: order.agreedTotalUsd.sub(costTotal),
      },
    })
    for (const item of items) {
      const productId = item.fulfilledProductId as string
      const product = productMap.get(productId)!
      const lineTotal = item.unitPriceUsd.mul(item.quantity).toDecimalPlaces(2)
      const lineCost = product.costPrice.mul(item.quantity).toDecimalPlaces(2)
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId,
          kind: item.unitPriceUsd.equals(0) ? "ZERO_COST" : "NORMAL",
          units: item.quantity,
          unitPrice: item.unitPriceUsd,
          unitCost: product.costPrice,
          extraCost: new Prisma.Decimal(0),
          lineTotal,
          lineCost,
          lineProfit: lineTotal.sub(lineCost),
        },
      })
      const updated = await tx.product.updateMany({ where: { id: productId, tenantId: params.tenantId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } })
      if (updated.count !== 1) throw new Error("Conflicto de stock al convertir el pedido en venta.")
    }
    const payments = await tx.$queryRaw<Array<{
      id: string
      method: PaymentMethod
      currency: Currency
      amount: Prisma.Decimal
      exchangeRate: Prisma.Decimal | null
      amountUsd: Prisma.Decimal | null
      coveredBaseUsd: Prisma.Decimal | null
      surchargePct: Prisma.Decimal | null
      surchargeAmount: Prisma.Decimal | null
      installments: number | null
      installmentAmount: Prisma.Decimal | null
      pricingSnapshot: Prisma.JsonValue | null
      cashAccountId: string | null
      paidAt: Date
      note: string | null
    }>>(Prisma.sql`SELECT * FROM "CustomerOrderPayment" WHERE "orderId" = ${order.id} ORDER BY "paidAt" ASC`)
    for (const payment of payments) {
      const salePayment = await tx.payment.create({
        data: {
          saleId: sale.id,
          method: payment.method,
          currency: payment.currency,
          amount: payment.amount,
          exchangeRate: payment.exchangeRate,
          amountUsd: payment.amountUsd,
          coveredBaseUsd: payment.coveredBaseUsd,
          surchargePct: payment.surchargePct,
          surchargeAmount: payment.surchargeAmount,
          installments: payment.installments,
          installmentAmount: payment.installmentAmount,
          pricingSnapshot: payment.pricingSnapshot as Prisma.InputJsonValue,
          cashAccountId: payment.cashAccountId,
          paidAt: payment.paidAt,
          note: payment.note,
        },
      })
      await tx.$executeRaw(Prisma.sql`UPDATE "Payment" SET "originCustomerOrderPaymentId" = ${payment.id} WHERE "id" = ${salePayment.id}`)
    }
    await tx.$executeRaw(Prisma.sql`
      UPDATE "CustomerOrderInventoryAllocation" SET "status" = 'CONSUMED'::"CustomerOrderAllocationStatus", "consumedAt" = NOW()
      WHERE "orderId" = ${order.id} AND "status" = 'ACTIVE'::"CustomerOrderAllocationStatus"
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE "CustomerOrder" SET "status" = 'CONVERTED'::"CustomerOrderStatus", "convertedSaleId" = ${sale.id}, "convertedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${order.id}
    `)
    await auditOrder(tx, { ...params, action: "ORDER_CONVERTED", orderId: order.id, detail: `Pedido convertido en venta ${sale.id}`, metadata: { saleId: sale.id } })
    return { saleId: sale.id, alreadyConverted: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function updateCustomerOrderSettings(params: Actor & {
  minimumDepositUsd: Prisma.Decimal
  defaultDeliveryDays: number
  deliveryDisclaimer: string
}) {
  if (params.minimumDepositUsd.lessThan(0)) throw new Error("La seña mínima no puede ser negativa.")
  if (!Number.isInteger(params.defaultDeliveryDays) || params.defaultDeliveryDays < 0 || params.defaultDeliveryDays > 365) throw new Error("Los días de entrega deben estar entre 0 y 365.")
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "TenantSettings" SET
      "customerOrderMinimumDepositUsd" = ${params.minimumDepositUsd},
      "customerOrderDefaultDeliveryDays" = ${params.defaultDeliveryDays},
      "customerOrderDeliveryDisclaimer" = ${params.deliveryDisclaimer},
      "updatedAt" = NOW()
    WHERE "tenantId" = ${params.tenantId}
  `)
  return rawSettings(params.tenantId)
}

export async function getCustomerOrderSettings(tenantId: string) {
  return rawSettings(tenantId)
}
