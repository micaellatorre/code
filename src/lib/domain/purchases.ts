import {
  Condition,
  Currency,
  PaymentMethod,
  Prisma,
  ProductType,
  type UserRole,
} from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { decimal, normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money"
import { fromArgDateInputValue } from "@/lib/timezone"
import { assertSupplierCoversBranch } from "@/lib/domain/suppliers"
import { isMonetaryPaymentMethod, postPurchasePaymentToCash } from "@/lib/domain/cash"
import { productCatalogDisplaySelect } from "@/lib/products/selects"
import { buildProductCatalogUpdate } from "@/lib/config/productCatalogLinks"

const currencySchema = z.nativeEnum(Currency)

export const purchasePaymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  currency: currencySchema,
  amount: z.union([z.string(), z.number()]),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
  cashAccountId: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

const purchasePaymentStatuses = ["PAID", "PARTIAL", "CURRENT_ACCOUNT"] as const
export const purchasePaymentStatusSchema = z.enum(purchasePaymentStatuses)
export const purchasePaymentStatusUpdateSchema = z.object({
  paymentStatus: purchasePaymentStatusSchema,
  markProductsInStock: z.boolean().optional().default(false),
  payment: purchasePaymentSchema.optional().nullable(),
})
type PurchasePaymentStatusValue = z.infer<typeof purchasePaymentStatusSchema>

const purchaseBaseItemSchema = z.object({
  catalogModelId: z.string().trim().min(1, "El modelo de catalogo es obligatorio"),
  modelName: z.string().trim().max(180).optional().default(""),
  catalogColorId: z.string().trim().optional().nullable(),
  color: z.string().trim().max(80).optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.union([z.string(), z.number()]),
  salePrice: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const phoneItemSchema = purchaseBaseItemSchema.extend({
  type: z.literal(ProductType.PHONE),
  catalogCapacityId: z.string().trim().min(1, "La capacidad de catalogo es obligatoria"),
  capacityGB: z.coerce.number().int().positive().optional().nullable(),
  condition: z.nativeEnum(Condition).optional().nullable(),
  physicalState: z.enum(["NEW", "USED"]).optional().default("USED"),
  batteryPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
  imeis: z.array(z.string().optional().nullable()).optional().default([]),
  unitNotes: z.array(z.string().optional().nullable()).optional().default([]),
})

const accessoryItemSchema = purchaseBaseItemSchema.extend({
  type: z.literal(ProductType.ACCESSORY),
  catalogCapacityId: z.string().trim().optional().nullable(),
  relatedModel: z.string().trim().max(120).optional().nullable(),
})

export const purchaseSchema = z.object({
  supplierId: z.string().min(1),
  date: z.string().optional().nullable(),
  currency: currencySchema,
  branchId: z.string().min(1, "La sucursal es obligatoria"),
  notes: z.string().optional().nullable(),
  items: z.array(z.discriminatedUnion("type", [phoneItemSchema, accessoryItemSchema])).min(1),
  payments: z.array(purchasePaymentSchema).optional().default([]),
})

type PurchaseInput = z.infer<typeof purchaseSchema>
type PurchaseItemInput = PurchaseInput["items"][number]

function normalizeImei(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").trim() || null
}

function assertValidImei(imei: string, label: string) {
  if (!/^\d{14,17}$/.test(imei)) {
    throw new Error(`IMEI invalido para ${label}`)
  }
}

function parsePurchaseDate(value: string | null | undefined) {
  if (!value) return new Date()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fromArgDateInputValue(value)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha de compra invalida")
  return parsed
}

function itemLineCost(item: PurchaseItemInput) {
  return decimal(item.unitCost).mul(item.quantity)
}

function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toString()
}

function derivePaymentStatus(totalCost: Prisma.Decimal, paidUsd: Prisma.Decimal): PurchasePaymentStatusValue {
  if (paidUsd.greaterThanOrEqualTo(totalCost)) return "PAID"
  if (paidUsd.greaterThan(0)) return "PARTIAL"
  return "CURRENT_ACCOUNT"
}

function legacyDownPaymentUsd(row: { currency: Currency; downPayment: Prisma.Decimal | null }) {
  if (!row.downPayment) return new Prisma.Decimal(0)
  if (row.currency !== "USD" && row.currency !== "USDT") return new Prisma.Decimal(0)
  return row.downPayment
}

const purchaseSerializationSelect = Prisma.validator<Prisma.PurchaseSelect>()({
  id: true,
  tenantId: true,
  supplierId: true,
  supplier: { select: { id: true, name: true } },
  branchId: true,
  branch: { select: { id: true, code: true, name: true } },
  date: true,
  currency: true,
  totalCost: true,
  downPayment: true,
  notes: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      units: true,
      unitCost: true,
      totalCost: true,
      product: {
        select: {
          id: true,
          type: true,
          modelName: true,
          imei: true,
          color: true,
          capacityGB: true,
          state: true,
          ...productCatalogDisplaySelect,
        },
      },
    },
  },
  payments: true,
})

type PurchaseForSerialization = Prisma.PurchaseGetPayload<{ select: typeof purchaseSerializationSelect }>

export function serializePurchase(row: PurchaseForSerialization) {
  const paidUsd = row.payments
    .reduce((acc, payment) => acc.add(payment.amountUsd ?? 0), new Prisma.Decimal(0))
    .add(legacyDownPaymentUsd(row))
  const derivedPaymentStatus = derivePaymentStatus(row.totalCost, paidUsd)

  return {
    id: row.id,
    tenantId: row.tenantId,
    supplierId: row.supplierId,
    supplier: row.supplier ? { id: row.supplier.id, name: row.supplier.name } : null,
    branchId: row.branchId,
    branch: row.branch ? { id: row.branch.id, code: row.branch.code, name: row.branch.name } : null,
    date: row.date.toISOString(),
    currency: row.currency,
    totalCost: row.totalCost.toString(),
    downPayment: serializeDecimal(row.downPayment),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    paymentStatus: derivedPaymentStatus,
    paidUsd: paidUsd.toString(),
    totalUnits: row.items.reduce((acc, item) => acc + item.units, 0),
    productTypes: Array.from(new Set(row.items.map((item) => item.product.type))),
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      units: item.units,
      unitCost: item.unitCost.toString(),
      totalCost: item.totalCost.toString(),
      product: {
        id: item.product.id,
        type: item.product.type,
        modelName: item.product.modelName,
        imei: item.product.imei,
        color: item.product.color,
        capacityGB: item.product.capacityGB,
        state: item.product.state,
        catalogModelId: item.product.catalogModelId,
        catalogCapacityId: item.product.catalogCapacityId,
        catalogColorId: item.product.catalogColorId,
        catalogModel: item.product.catalogModel,
        catalogCapacity: item.product.catalogCapacity,
        catalogColor: item.product.catalogColor,
      },
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      currency: payment.currency,
      amount: payment.amount.toString(),
      exchangeRate: serializeDecimal(payment.exchangeRate),
      amountUsd: serializeDecimal(payment.amountUsd),
      note: payment.note,
      paidAt: payment.paidAt.toISOString(),
    })),
  }
}

export async function listPurchases(params: {
  tenantId: string
  q?: string | null
  type?: ProductType | null
}) {
  const q = params.q?.trim()
  const where: Prisma.PurchaseWhereInput = {
    tenantId: params.tenantId,
    ...(params.type ? { items: { some: { product: { type: params.type } } } } : {}),
    ...(q ? {
      OR: [
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { items: { some: { product: { modelName: { contains: q, mode: "insensitive" } } } } },
        { items: { some: { product: { catalogModel: { is: { name: { contains: q, mode: "insensitive" } } } } } } },
        { items: { some: { product: { catalogColor: { is: { name: { contains: q, mode: "insensitive" } } } } } } },
        { items: { some: { product: { imei: { contains: q, mode: "insensitive" } } } } },
      ],
    } : {}),
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: "desc" },
    select: purchaseSerializationSelect,
  })

  return purchases.map(serializePurchase)
}

export async function createPurchaseWithPayments(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  actorRealRole?: UserRole
  input: PurchaseInput
}) {
  const input = purchaseSchema.parse(params.input)

  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: { id: input.branchId, tenantId: params.tenantId, isActive: true },
      select: { id: true, code: true, name: true },
    })
    if (!branch) throw new Error("Sucursal no disponible")

    const supplier = await assertSupplierCoversBranch({
      tenantId: params.tenantId,
      supplierId: input.supplierId,
      branchId: branch.id,
      tx,
    })

    const purchaseDate = parsePurchaseDate(input.date)
    const totalCost = input.items.reduce((acc, item) => acc.add(itemLineCost(item)), new Prisma.Decimal(0))

    const imeis = input.items.flatMap((item) => item.type === ProductType.PHONE
      ? Array.from({ length: item.quantity }, (_, index) => normalizeImei(item.imeis[index]))
      : [])
    const missingImei = imeis.findIndex((imei) => !imei)
    if (missingImei >= 0) throw new Error("IMEI obligatorio para equipos en stock")

    const normalizedImeis = imeis.filter((imei): imei is string => Boolean(imei))
    normalizedImeis.forEach((imei, index) => assertValidImei(imei, `unidad ${index + 1}`))
    if (new Set(normalizedImeis).size !== normalizedImeis.length) throw new Error("Hay IMEIs duplicados en la compra")

    if (normalizedImeis.length) {
      const existingImeis = await tx.product.findMany({
        where: { tenantId: params.tenantId, imei: { in: normalizedImeis } },
        select: { imei: true },
      })
      if (existingImeis.length) throw new Error(`El IMEI ${existingImeis[0].imei} ya existe en inventario`)
    }

    const purchase = await tx.purchase.create({
      data: {
        tenantId: params.tenantId,
        supplierId: supplier.id,
        date: purchaseDate,
        currency: input.currency,
        downPayment: null,
        totalCost,
        branchId: branch.id,
        notes: input.notes?.trim() || null,
      },
      select: { id: true, branchId: true },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "PURCHASE",
      entityType: "Purchase",
      entityId: purchase.id,
      detail: "Compra registrada",
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
      metadata: {
        supplierId: supplier.id,
        supplierName: supplier.name,
        branchId: branch.id,
        branchName: branch.name,
        currency: input.currency,
        totalCost: totalCost.toString(),
        itemCount: input.items.length,
        totalUnits: input.items.reduce((acc, item) => acc + item.quantity, 0),
      },
    }, tx)

    const stockItems: Array<{ productId: string; modelName: string; units: number; productType: ProductType }> = []
    const createdProductIds: string[] = []
    let totalUnits = 0

    for (const item of input.items) {
      const unitCost = decimal(item.unitCost)
      const salePrice = decimal(item.salePrice ?? 0)
      const catalogData = await buildProductCatalogUpdate(
        params.tenantId,
        {
          catalogModelId: item.catalogModelId,
          catalogCapacityId: item.type === ProductType.PHONE ? item.catalogCapacityId : null,
          catalogColorId: item.catalogColorId ?? null,
        },
        item.type,
      )
      const catalogModelName = String(catalogData.modelName ?? "").trim()
      if (!catalogModelName) throw new Error("Modelo de catalogo no disponible")

      if (item.type === ProductType.PHONE) {
        for (let index = 0; index < item.quantity; index += 1) {
          const imei = normalizeImei(item.imeis[index])
          const product = await tx.product.create({
            data: {
              tenantId: params.tenantId,
              type: ProductType.PHONE,
              brand: "Apple",
              ...(catalogData as any),
              modelName: catalogModelName,
              condition: item.condition ?? (item.physicalState === "NEW" ? Condition.SEALED : Condition.ASIS),
              batteryPct: item.physicalState === "USED" ? item.batteryPct ?? null : null,
              imei,
              purchaseDate,
              costPrice: unitCost,
              salePrice,
              status: "AVAILABLE",
              state: "EN_CAMINO",
              stockInitial: 1,
              stock: 1,
              stockAvailable: 1,
              branchId: branch.id,
              supplierId: supplier.id,
              origin: supplier.name,
              notes: [item.notes?.trim(), item.unitNotes[index]?.trim()].filter(Boolean).join(" | ") || null,
            },
          })
          await tx.purchaseItem.create({
            data: { purchaseId: purchase.id, productId: product.id, units: 1, unitCost, totalCost: unitCost },
          })
          stockItems.push({ productId: product.id, modelName: product.modelName, units: 1, productType: ProductType.PHONE })
          createdProductIds.push(product.id)
          totalUnits += 1
        }
      } else {
        const product = await tx.product.create({
          data: {
            tenantId: params.tenantId,
            type: ProductType.ACCESSORY,
            ...(catalogData as any),
            modelName: catalogModelName,
            purchaseDate,
            costPrice: unitCost,
            salePrice,
            status: "AVAILABLE",
            state: "EN_CAMINO",
            stockInitial: item.quantity,
            stock: item.quantity,
            stockAvailable: item.quantity,
            branchId: branch.id,
            supplierId: supplier.id,
            origin: supplier.name,
            notes: [item.relatedModel ? `Para modelo: ${item.relatedModel.trim()}` : null, item.notes?.trim()].filter(Boolean).join(" | ") || null,
          },
        })
        await tx.purchaseItem.create({
          data: { purchaseId: purchase.id, productId: product.id, units: item.quantity, unitCost, totalCost: unitCost.mul(item.quantity) },
        })
        stockItems.push({ productId: product.id, modelName: product.modelName, units: item.quantity, productType: ProductType.ACCESSORY })
        createdProductIds.push(product.id)
        totalUnits += item.quantity
      }
    }

    const paymentRows = []
    for (const payment of input.payments) {
      const amount = decimal(payment.amount)
      const exchangeRate = optionalDecimal(payment.exchangeRate)
      const amountUsd = normalizeAmountUsd(amount, payment.currency, exchangeRate)
      const row = await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          method: payment.method,
          currency: payment.currency,
          amount,
          exchangeRate,
          amountUsd,
          cashAccountId: isMonetaryPaymentMethod(payment.method) ? payment.cashAccountId || null : null,
          paidAt: parsePurchaseDate(payment.paidAt),
          note: payment.note?.trim() || null,
        },
      })
      paymentRows.push(row)
      await postPurchasePaymentToCash({
        tx,
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        purchase: { id: purchase.id, branchId: purchase.branchId },
        payment: row,
      })
      await createAuditLog({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: "PAYMENT_CREATED",
        module: "PURCHASE",
        entityType: "Purchase",
        entityId: purchase.id,
        detail: "Pago de compra registrado",
        executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
        simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
        metadata: {
          purchasePaymentId: row.id,
          method: row.method,
          currency: row.currency,
          amount: row.amount.toString(),
          exchangeRate: serializeDecimal(row.exchangeRate),
          amountUsd: serializeDecimal(row.amountUsd),
        },
      }, tx)
    }

    const finalPaymentStatus = derivePaymentStatus(totalCost, paymentRows.reduce((acc, payment) => acc.add(payment.amountUsd ?? 0), new Prisma.Decimal(0)))

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "STOCK_CHANGE",
      module: "PURCHASE",
      entityType: "Purchase",
      entityId: purchase.id,
      detail: "Mercaderia creada en productos con estado En camino",
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
      metadata: {
        productsCreated: createdProductIds.length,
        unitsCreated: totalUnits,
        branchId: branch.id,
        branchName: branch.name,
        items: stockItems.map((item) => ({ productId: item.productId, modelName: item.modelName, units: item.units })),
      },
    }, tx)

    const fullPurchase = await tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      select: purchaseSerializationSelect,
    })

    return {
      purchase: serializePurchase(fullPurchase),
      productIds: createdProductIds,
      summary: {
        currency: input.currency,
        totalCost: totalCost.toString(),
        totalUnits,
        productCount: createdProductIds.length,
        paymentStatus: finalPaymentStatus,
      },
    }
  })
}

export async function updatePurchasePaymentStatus(params: {
  tenantId: string
  purchaseId: string
  input: z.infer<typeof purchasePaymentStatusUpdateSchema>
  actorUserId: string
  actorRole: UserRole
  actorRealRole?: UserRole
}) {
  const input = purchasePaymentStatusUpdateSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: { id: params.purchaseId, tenantId: params.tenantId },
      select: purchaseSerializationSelect,
    })
    if (!purchase) throw new Error("Compra no encontrada")

    const currentPaidUsd = purchase.payments
      .reduce((acc, payment) => acc.add(payment.amountUsd ?? 0), new Prisma.Decimal(0))
      .add(legacyDownPaymentUsd(purchase))
    const currentStatus = derivePaymentStatus(purchase.totalCost, currentPaidUsd)
    let nextPaidUsd = currentPaidUsd
    let paymentId: string | null = null

    if (input.payment) {
      const amount = decimal(input.payment.amount)
      if (amount.lessThanOrEqualTo(0)) throw new Error("El monto del pago debe ser mayor a cero.")
      const exchangeRate = optionalDecimal(input.payment.exchangeRate)
      const amountUsd = normalizeAmountUsd(amount, input.payment.currency, exchangeRate)
      const payment = await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          method: input.payment.method,
          currency: input.payment.currency,
          amount,
          exchangeRate,
          amountUsd,
          cashAccountId: isMonetaryPaymentMethod(input.payment.method) ? input.payment.cashAccountId || null : null,
          paidAt: parsePurchaseDate(input.payment.paidAt),
          note: input.payment.note?.trim() || null,
        },
      })
      paymentId = payment.id
      nextPaidUsd = nextPaidUsd.add(payment.amountUsd ?? 0)
      await postPurchasePaymentToCash({
        tx,
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        purchase: { id: purchase.id, branchId: purchase.branchId },
        payment,
      })
      await createAuditLog({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: "PAYMENT_CREATED",
        module: "PURCHASE",
        entityType: "Purchase",
        entityId: purchase.id,
        detail: "Pago de compra registrado desde actualizacion de estado",
        executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
        simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
        metadata: {
          purchasePaymentId: payment.id,
          method: payment.method,
          currency: payment.currency,
          amount: payment.amount.toString(),
          exchangeRate: serializeDecimal(payment.exchangeRate),
          amountUsd: serializeDecimal(payment.amountUsd),
        },
      }, tx)
    }

    const nextStatus = derivePaymentStatus(purchase.totalCost, nextPaidUsd)
    if (input.paymentStatus === "PAID" && nextStatus !== "PAID") {
      throw new Error("El pago registrado no alcanza para marcar la compra como pagada.")
    }
    if (input.paymentStatus === "PARTIAL" && nextStatus === "CURRENT_ACCOUNT") {
      throw new Error("Registra un pago para marcar la compra como parcial.")
    }
    if (input.paymentStatus === "CURRENT_ACCOUNT" && nextStatus !== "CURRENT_ACCOUNT") {
      throw new Error("La compra tiene pagos registrados; no se puede marcar como cuenta corriente sin revertirlos desde caja.")
    }

    let stockUpdated = 0
    if (input.markProductsInStock) {
      const result = await tx.product.updateMany({
        where: {
          tenantId: params.tenantId,
          state: "EN_CAMINO",
          PurchaseItem: { some: { purchaseId: purchase.id } },
        },
        data: { state: "EN_STOCK" },
      })
      stockUpdated = result.count
      if (stockUpdated > 0) {
        await createAuditLog({
          tenantId: params.tenantId,
          actorUserId: params.actorUserId,
          actorRole: params.actorRole,
          action: "STOCK_CHANGE",
          module: "PURCHASE",
          entityType: "Purchase",
          entityId: purchase.id,
          detail: "Productos de compra marcados En stock",
          executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
          simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
          metadata: { productsUpdated: stockUpdated, fromState: "EN_CAMINO", toState: "EN_STOCK" },
        }, tx)
      }
    }

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "PURCHASE",
      entityType: "Purchase",
      entityId: purchase.id,
      detail: `Estado de pago recalculado: ${currentStatus} -> ${nextStatus}`,
      oldValue: { paymentStatus: currentStatus, paidUsd: currentPaidUsd.toString() },
      newValue: { paymentStatus: nextStatus, paidUsd: nextPaidUsd.toString(), paymentId, stockUpdated },
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
    }, tx)

    return {
      id: purchase.id,
      paymentStatus: nextStatus,
      paidUsd: nextPaidUsd.toString(),
      stockUpdated,
      paymentId,
    }
  })
}
