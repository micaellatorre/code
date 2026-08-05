// code/src/app/api/sales/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { Prisma, ProductState, SaleItemKind, SaleStatus, UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { createAuditLog } from "@/lib/domain/audit"
import { canManuallyAssignEntityBranch } from "@/lib/domain/user-branches"
import { isMonetaryPaymentMethod, postSalePaymentToCash, reverseSourceCashMovement } from "@/lib/domain/cash"
import { normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money"
import { normalizeCatalogValue } from "@/lib/config/normalizeCatalogValue"
import { productCatalogDisplayInclude } from "@/lib/products/selects"

export const runtime = "nodejs"

const DECIMAL_FIELDS = new Set([
  "subtotal",
  "extraCosts",
  "total",
  "profit",
  "costTotal",
  "amountPaid",
  "balanceDue",
])

const ALLOWED_FIELDS = new Set<string>([
  "date",
  "customerName",
  "origin",
  "notes",
  "status",
  "amountPaid",
  "balanceDue",
  "subtotal",
  "extraCosts",
  "total",
  "profit",
  "costTotal",
  "buyer",
  "buyerId",
  "items",
  "payments",
  "userId",
  "branchId",
  "closerId",
  "saleType",
  "operationType",
  "appointmentId",
  "operationFlow",
  "tradeInDevices",
])

const SELLER_CONFIRMED_SALE_ALLOWED_FIELDS = new Set(["buyerId", "buyer", "customerName", "saleType"])

type Ctx = { params: Promise<{ id: string }> }

type PaymentInput = {
  id?: string | null
  method?: string
  currency?: string
  amount?: string | number | Prisma.Decimal | null
  exchangeRate?: string | number | Prisma.Decimal | null
  cashAccountId?: string | null
  note?: string | null
  paidAt?: string | Date | null
}

type SaleItemInput = {
  clientLineId?: string | null
  parentClientLineId?: string | null
  productId?: string
  kind?: string
  units?: number | string
  unitPrice?: string | number | Prisma.Decimal | null
  unitCost?: string | number | Prisma.Decimal | null
  extraCost?: string | number | Prisma.Decimal | null
}

function toDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return null
  return new Prisma.Decimal(n)
}

function decimal(v: unknown): Prisma.Decimal {
  return toDecimal(v) ?? new Prisma.Decimal(0)
}

function decimalEquals(left: unknown, right: unknown) {
  if (left == null && right == null) return true
  if (left == null || right == null) return false
  return decimal(left).equals(decimal(right))
}

function dateEquals(left: Date | null | undefined, right: Date | null | undefined) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null)
}

function nextProductState(type: string, stock: number, state: ProductState): ProductState {
  if (stock < 1) {
    return type === "PHONE"
      ? ("VENDIDO" as ProductState)
      : ("FUERA_DE_STOCK" as ProductState)
  }

  if (
    state === ("VENDIDO" as ProductState) ||
    state === "FUERA_DE_STOCK"
  ) {
    return "EN_STOCK"
  }

  return state
}

function assertSaleStatus(value: unknown): SaleStatus {
  if (value === "CONFIRMADA" || value === "SENADA" || value === "CANCELADA") {
    return value
  }

  throw new Error("Estado de venta inválido")
}

function assertSaleItemKind(value: unknown): SaleItemKind {
  if (value === "NORMAL" || value === "IN_TOTAL" || value === "ZERO_COST") {
    return value
  }

  throw new Error("Tipo de ítem inválido")
}

function aggregateUnits(items: Array<{ productId: string; units: number }>) {
  const unitsByProduct = new Map<string, number>()

  for (const item of items) {
    unitsByProduct.set(
      item.productId,
      (unitsByProduct.get(item.productId) ?? 0) + item.units,
    )
  }

  return unitsByProduct
}

async function resolveProductCatalogModelId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  product: { catalogModelId?: string | null; type: string; modelName: string },
) {
  if (product.catalogModelId) return product.catalogModelId
  const catalog = await tx.productCatalogModel.findFirst({
    where: {
      tenantId,
      type: product.type as any,
      normalizedName: normalizeCatalogValue(product.modelName),
    },
    select: { id: true },
  })
  return catalog?.id ?? null
}

async function assertParentLinks(params: {
  tx: Prisma.TransactionClient
  tenantId: string
  items: (SaleItemInput & { clientLineId: string; productId: string })[]
  productMap: Map<string, any>
}) {
  const itemByClientLineId = new Map(params.items.map((item) => [item.clientLineId, item]))

  for (const item of params.items) {
    if (!item.parentClientLineId) continue
    if (item.parentClientLineId === item.clientLineId) throw new Error("No se permite una asociacion circular.")
    const parent = itemByClientLineId.get(item.parentClientLineId)
    if (!parent) throw new Error("El accesorio asociado no tiene un equipo padre valido.")

    const parentProduct = params.productMap.get(parent.productId)
    const childProduct = params.productMap.get(item.productId)
    if (!parentProduct || !childProduct) throw new Error("Producto asociado no disponible.")
    if (parentProduct.type !== "PHONE") throw new Error("El item padre debe ser un equipo PHONE.")
    if (childProduct.type !== "ACCESSORY") throw new Error("El item asociado debe ser un accesorio.")

    const phoneCatalogModelId = await resolveProductCatalogModelId(params.tx, params.tenantId, parentProduct)
    const accessoryCatalogModelId = await resolveProductCatalogModelId(params.tx, params.tenantId, childProduct)
    if (!phoneCatalogModelId || !accessoryCatalogModelId) {
      throw new Error("Los items asociados deben tener modelo de catalogo compatible.")
    }

    const compatibility = await params.tx.productModelCompatibility.findFirst({
      where: {
        tenantId: params.tenantId,
        phoneModelId: phoneCatalogModelId,
        accessoryModelId: accessoryCatalogModelId,
        isActive: true,
      },
      select: { id: true },
    })

    if (!compatibility) throw new Error("El accesorio no es compatible con el equipo seleccionado.")
  }
}

function saleInclude() {
  return {
    buyer: true,
    user: { select: { id: true, name: true, email: true } },
    branch: { select: { id: true, code: true, name: true } },
    items: { include: { product: { include: productCatalogDisplayInclude } } },
    payments: { orderBy: { paidAt: "asc" as const } },
  }
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = auth.session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const sale = await prisma.sale.findFirst({
    where: { id, tenantId },
    include: saleInclude(),
  })

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ sale: serializeSale(sale) })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = auth.session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id, tenantId }, include: { items: { include: { product: true } } } })
      if (!sale) throw new Error("Venta no encontrada")
      if (sale.status === "CANCELADA") return

      if (sale.status === "CONFIRMADA") {
        for (const item of sale.items) {
          const nextStock = item.product.stock + item.units
          const nextAvailable = item.product.stockAvailable + item.units
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: nextStock,
              stockAvailable: nextAvailable,
              state: item.product.state === "VENDIDO" || item.product.state === "FUERA_DE_STOCK" ? "EN_STOCK" : item.product.state,
            },
          })
        }
      }

      if (sale.status === "SENADA") {
        for (const item of sale.items) {
          await tx.product.update({ where: { id: item.productId }, data: { senado: false, senadoAt: null } })
        }
      }

      await tx.sale.update({ where: { id }, data: { status: "CANCELADA" } })
    })

    return NextResponse.json({ ok: true, mode: "cancelled" })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json(
      { error: error?.message ?? "DELETE failed" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = auth.session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const keys = Object.keys(body || {})

  if (keys.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 })
  }

  if (!keys.every((k) => ALLOWED_FIELDS.has(k))) {
    return NextResponse.json(
      { error: "Some fields are not allowed" },
      { status: 400 },
    )
  }

  let requestedStatus: SaleStatus | null = null

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    try {
      requestedStatus = assertSaleStatus(body.status)
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json(
        { error: error?.message ?? "Estado de venta inválido" },
        { status: 400 },
      )
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          buyer: true,
          branch: { select: { id: true, name: true } },
          items: true,
          payments: true,
        },
      })

      if (!sale) {
        throw new Error("Venta no encontrada")
      }
      if (sale.tenantId !== tenantId) {
        throw new Error("Venta no encontrada")
      }

      if (
        sale.status === "CONFIRMADA" &&
        auth.session.user.activeRole !== "ADMIN" &&
        !keys.every((key) => SELLER_CONFIRMED_SALE_ALLOWED_FIELDS.has(key))
      ) {
        throw new Error(
          "La venta confirmada solo puede modificarse con rol activo ADMIN.",
        )
      }

      const targetStatus = requestedStatus ?? sale.status

      const saleData: Prisma.SaleUpdateInput = {}

      if (Object.prototype.hasOwnProperty.call(body, "date")) {
        if (body.date == null || String(body.date).trim() === "") {
          throw new Error("Fecha inválida")
        }

        const date = new Date(body.date as string | number)

        if (Number.isNaN(date.getTime())) {
          throw new Error("Fecha inválida")
        }

        saleData.date = date
      }

      if (Object.prototype.hasOwnProperty.call(body, "customerName")) {
        saleData.customerName =
          body.customerName == null ? null : String(body.customerName).trim()
      }

      if (Object.prototype.hasOwnProperty.call(body, "origin")) {
        saleData.origin =
          body.origin == null || String(body.origin).trim() === ""
            ? null
            : String(body.origin).trim()
      }

      if (Object.prototype.hasOwnProperty.call(body, "notes")) {
        saleData.notes =
          body.notes == null || String(body.notes).trim() === ""
            ? null
            : String(body.notes)
      }

      if (Object.prototype.hasOwnProperty.call(body, "userId")) {
        const rawUserId =
          body.userId == null || String(body.userId).trim() === ""
            ? null
            : String(body.userId).trim()

        if (!rawUserId) {
          saleData.user = { disconnect: true }
        } else {
          const tenantId = auth.session.user.tenantId

          if (!tenantId) {
            throw new Error("Tenant no disponible para el usuario autenticado")
          }

          const targetUser = await tx.user.findUnique({
            where: { id: rawUserId },
            select: { id: true, tenantId: true },
          })

          if (!targetUser || targetUser.tenantId !== tenantId) {
            throw new Error("Usuario no disponible")
          }

          saleData.user = { connect: { id: targetUser.id } }
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "branchId")) {
        if (!canManuallyAssignEntityBranch(auth.session.user.activeRole)) {
          throw new Error("No tenes permisos para cambiar la sucursal de una venta.")
        }
        const branchId = body.branchId == null || String(body.branchId).trim() === "" ? null : String(body.branchId)
        if (!branchId) {
          saleData.branch = { disconnect: true }
        } else {
          const branch = await tx.branch.findFirst({ where: { id: branchId, tenantId: sale.tenantId, isActive: true }, select: { id: true } })
          if (!branch) throw new Error("Sucursal no disponible")
          saleData.branch = { connect: { id: branch.id } }
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "closerId")) {
        const closerId = body.closerId == null || String(body.closerId).trim() === "" ? null : String(body.closerId)
        if (!closerId) {
          saleData.closer = { disconnect: true }
        } else {
          const closer = await tx.user.findFirst({ where: { id: closerId, tenantId: sale.tenantId, role: "VENDEDOR", isActive: true }, select: { id: true } })
          if (!closer) throw new Error("Closer no disponible. Debe ser un usuario vendedor activo.")
          saleData.closer = { connect: { id: closer.id } }
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "saleType")) {
        if (body.saleType === "MINORISTA" || body.saleType === "MAYORISTA" || body.saleType == null || body.saleType === "") {
          saleData.saleType = body.saleType ? String(body.saleType) as any : null
        } else {
          throw new Error("Tipo de venta invalido")
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "buyerId")) {
        const buyerId =
          body.buyerId == null || String(body.buyerId).trim() === ""
            ? null
            : String(body.buyerId).trim()

        if (!buyerId) {
          saleData.buyer = { disconnect: true }
          saleData.customerName = null
        } else {
          const buyer = await tx.buyer.findFirst({
            where: {
              id: buyerId,
              tenantId: sale.tenantId,
            },
            select: {
              id: true,
              name: true,
              surname: true,
            },
          })

          if (!buyer) {
            throw new Error("Comprador no disponible")
          }

          saleData.buyer = { connect: { id: buyer.id } }
          saleData.customerName =
            [buyer.name, buyer.surname].filter(Boolean).join(" ") || null
        }
      } else {
        const buyerObj = body.buyer as Record<string, string> | undefined

        if (buyerObj && typeof buyerObj === "object") {
          const name = (buyerObj.name ?? "").trim()
          const surname = (buyerObj.surname ?? "").trim()

          if (!name) {
            throw new Error("El comprador debe tener nombre")
          }

          if (sale.buyerId) {
            const existingBuyer = await tx.buyer.findFirst({
              where: {
                id: sale.buyerId,
                tenantId: sale.tenantId,
              },
              select: { id: true },
            })

            if (!existingBuyer) {
              throw new Error("Comprador actual no disponible")
            }

            const updatedBuyer = await tx.buyer.update({
              where: { id: sale.buyerId },
              data: {
                name,
                surname: surname || null,
              },
              select: {
                id: true,
                name: true,
                surname: true,
              },
            })

            saleData.buyer = { connect: { id: updatedBuyer.id } }
            saleData.customerName =
              [updatedBuyer.name, updatedBuyer.surname]
                .filter(Boolean)
                .join(" ") || null
          } else {
            const createdBuyer = await tx.buyer.create({
              data: {
                tenantId: sale.tenantId,
                name,
                surname: surname || null,
              },
              select: {
                id: true,
                name: true,
                surname: true,
              },
            })

            saleData.buyer = { connect: { id: createdBuyer.id } }
            saleData.customerName =
              [createdBuyer.name, createdBuyer.surname]
                .filter(Boolean)
                .join(" ") || null
          }
        }
      }

      const incomingItems = Array.isArray(body.items)
        ? (body.items as SaleItemInput[])
        : sale.items.map((item) => ({
            productId: item.productId,
            clientLineId: item.id,
            parentClientLineId: item.parentItemId,
            kind: item.kind,
            units: item.units,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            extraCost: item.extraCost,
          }))

      if (incomingItems.length === 0 && targetStatus !== "CANCELADA") {
        throw new Error("La venta debe tener al menos un item")
      }

      const incomingProductIds = Array.from(
        new Set(
          incomingItems
            .map((item) => item.productId)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      )
      const normalizedIncomingItems = incomingItems.map((item, index) => {
        const productId = String(item.productId || "").trim()
        return {
          ...item,
          productId,
          clientLineId: item.clientLineId || `server-line-${index}`,
          parentClientLineId: item.parentClientLineId || null,
        }
      })

      const oldProductIds = sale.items.map((item) => item.productId)

      const touchedProductIds = Array.from(
        new Set([...incomingProductIds, ...oldProductIds]),
      )

      const products = await tx.product.findMany({
        where: {
          id: { in: touchedProductIds },
          tenantId: sale.tenantId,
        },
        select: {
          id: true,
          type: true,
          modelName: true,
          catalogModelId: true,
          costPrice: true,
          stock: true,
          stockAvailable: true,
          state: true,
          senado: true,
        },
      })

      const productMap = new Map(products.map((product) => [product.id, product]))

      for (const productId of incomingProductIds) {
        if (!productMap.has(productId)) {
          throw new Error(`No se encontró el producto ${productId}`)
        }
      }
      await assertParentLinks({ tx, tenantId: sale.tenantId, items: normalizedIncomingItems, productMap })

      const oldUnitsByProduct = aggregateUnits(
        sale.items.map((item) => ({
          productId: item.productId,
          units: item.units,
        })),
      )

      const newUnitsByProduct = new Map<string, number>()

      let subtotal = new Prisma.Decimal(0)
      let costTotal = new Prisma.Decimal(0)
      let extraCosts = new Prisma.Decimal(0)

      const itemCreates = normalizedIncomingItems.map((raw) => {
        const productId = String(raw.productId || "").trim()

        if (!productId) {
          throw new Error("Cada ítem debe tener productId")
        }

        const product = productMap.get(productId)

        if (!product) {
          throw new Error(`No se encontró el producto ${productId}`)
        }

        const kind = assertSaleItemKind(raw.kind)

        const unitsNum = Number(raw.units)

        if (!Number.isInteger(unitsNum) || unitsNum < 1) {
          throw new Error(`Cantidad inválida para ${product.modelName}`)
        }

        newUnitsByProduct.set(
          productId,
          (newUnitsByProduct.get(productId) ?? 0) + unitsNum,
        )

        const units = new Prisma.Decimal(unitsNum)
        const unitPrice = decimal(raw.unitPrice)
        const unitCost = decimal(raw.unitCost ?? product.costPrice)
        const extraCost = decimal(raw.extraCost)

        const lineTotal =
          kind === "NORMAL" ? unitPrice.mul(units) : new Prisma.Decimal(0)

        const lineCost = unitCost.add(extraCost).mul(units)
        const lineProfit = lineTotal.sub(lineCost)

        if (kind === "NORMAL") {
          subtotal = subtotal.add(lineTotal)
        }

        if (kind === "IN_TOTAL") {
          extraCosts = extraCosts.add(lineCost)
        }

        costTotal = costTotal.add(lineCost)

        return {
          clientLineId: raw.clientLineId,
          parentClientLineId: raw.parentClientLineId,
          data: {
            saleId: id,
            productId,
            kind,
            units: unitsNum,
            unitPrice,
            unitCost,
            extraCost,
            lineTotal,
            lineCost,
            lineProfit,
          },
        }
      })

      const saleWasConfirmed = sale.status === "CONFIRMADA"
      const saleWillBeConfirmed = targetStatus === "CONFIRMADA"
      const saleWasReserved = sale.status === "SENADA"
      const saleWillBeReserved = targetStatus === "SENADA"

      for (const productId of touchedProductIds) {
        const product = productMap.get(productId)

        if (!product) {
          continue
        }

        const oldUnits = oldUnitsByProduct.get(productId) ?? 0
        const newUnits = newUnitsByProduct.get(productId) ?? 0

        const oldPhysicalEffect = saleWasConfirmed ? oldUnits : 0
        const newPhysicalEffect = saleWillBeConfirmed ? newUnits : 0

        const oldReservedAvailabilityEffect =
          saleWasReserved &&
          oldUnits > 0 &&
          product.stockAvailable <= product.stock - oldUnits
            ? oldUnits
            : 0

        const oldAvailableEffect = saleWasConfirmed
          ? oldUnits
          : oldReservedAvailabilityEffect

        const newAvailableEffect =
          saleWillBeConfirmed || saleWillBeReserved ? newUnits : 0

        const availableForNewEffect =
          product.stockAvailable + oldAvailableEffect

        if (newAvailableEffect > availableForNewEffect) {
          throw new Error(
            `Stock insuficiente para ${product.modelName}. Disponible: ${availableForNewEffect}`,
          )
        }

        const finalStock =
          product.stock + oldPhysicalEffect - newPhysicalEffect

        const finalStockAvailable =
          product.stockAvailable + oldAvailableEffect - newAvailableEffect

        if (finalStock < 0 || finalStockAvailable < 0) {
          throw new Error(`El ajuste deja stock negativo para ${product.modelName}`)
        }

        let nextState = nextProductState(
          product.type,
          finalStock,
          product.state,
        )

        let senado = false
        let senadoAt: Date | null = null

        if (saleWillBeReserved && newUnits > 0) {
          senado = true
          senadoAt = new Date()
        }

        if (saleWillBeConfirmed) {
          senado = false
          senadoAt = null
        }

        if (targetStatus === "CANCELADA") {
          senado = false
          senadoAt = null
          nextState = nextProductState(
            product.type,
            finalStock,
            product.state,
          )
        }

        const stockChanged =
          finalStock !== product.stock ||
          finalStockAvailable !== product.stockAvailable

        const reservationChanged =
          product.senado !== senado ||
          product.state !== nextState ||
          (senado && !product.senado)

        if (stockChanged || reservationChanged) {
          await tx.product.update({
            where: { id: productId },
            data: {
              stock: finalStock,
              stockAvailable: finalStockAvailable,
              senado,
              senadoAt,
              state: nextState,
            },
          })
        }
      }

      if (Array.isArray(body.items)) {
        await tx.saleItem.deleteMany({ where: { saleId: id } })

        const createdSaleItemIds = new Map<string, string>()
        const creationOrder = [
          ...itemCreates.filter((item) => !item.parentClientLineId),
          ...itemCreates.filter((item) => item.parentClientLineId),
        ]

        for (const itemCreate of creationOrder) {
          const createdItem = await tx.saleItem.create({
            data: {
              ...itemCreate.data,
              parentItemId: itemCreate.parentClientLineId ? createdSaleItemIds.get(itemCreate.parentClientLineId) ?? null : null,
            },
          })
          createdSaleItemIds.set(itemCreate.clientLineId, createdItem.id)
        }
      }

      const total = subtotal.add(extraCosts)
      const profit = total.sub(costTotal)

      let amountPaid = sale.amountPaid ?? new Prisma.Decimal(0)
      let balanceDue = total.sub(amountPaid)

      if (Array.isArray(body.payments)) {
        const payments = body.payments as PaymentInput[]
        const existingPayments = new Map(sale.payments.map((payment) => [payment.id, payment]))
        const keptPaymentIds = new Set<string>()

        const paymentsData = payments.map((payment) => {
          const amount = toDecimal(payment.amount)

          if (!amount || amount.lessThan(0)) {
            throw new Error("Monto de pago inválido")
          }

          if (!payment.method || !payment.currency) {
            throw new Error("Cada pago debe tener método y moneda")
          }

          return {
            id: payment.id == null || String(payment.id).trim() === "" ? null : String(payment.id),
            saleId: id,
            method: payment.method as any,
            currency: payment.currency as any,
            amount,
            exchangeRate: optionalDecimal(payment.exchangeRate),
            amountUsd: normalizeAmountUsd(amount, String(payment.currency), optionalDecimal(payment.exchangeRate)),
            cashAccountId: isMonetaryPaymentMethod(payment.method) ? payment.cashAccountId || null : null,
            note:
              payment.note == null || String(payment.note).trim() === ""
                ? null
                : String(payment.note),
            paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
          }
        })

        amountPaid = paymentsData.reduce(
          (acc, payment) => acc.add(payment.amount),
          new Prisma.Decimal(0),
        )

        balanceDue = total.sub(amountPaid)

        for (const paymentData of paymentsData) {
          const existing = paymentData.id ? existingPayments.get(paymentData.id) : null
          const data = {
            saleId: id,
            method: paymentData.method,
            currency: paymentData.currency,
            amount: paymentData.amount,
            exchangeRate: paymentData.exchangeRate,
            amountUsd: paymentData.amountUsd,
            cashAccountId: paymentData.cashAccountId,
            note: paymentData.note,
            paidAt: paymentData.paidAt,
          }
          const persisted = existing
            ? await tx.payment.update({ where: { id: existing.id }, data })
            : await tx.payment.create({ data })
          keptPaymentIds.add(persisted.id)

          const changedFinancially = !existing ||
            existing.method !== persisted.method ||
            existing.currency !== persisted.currency ||
            !decimalEquals(existing.amount, persisted.amount) ||
            !decimalEquals(existing.exchangeRate, persisted.exchangeRate) ||
            !decimalEquals(existing.amountUsd, persisted.amountUsd) ||
            existing.cashAccountId !== persisted.cashAccountId ||
            !dateEquals(existing.paidAt, persisted.paidAt)

          if (!changedFinancially || isMonetaryPaymentMethod(persisted.method)) {
            await postSalePaymentToCash({
              tx,
              tenantId: sale.tenantId,
              actorUserId: auth.session.user.id,
              actorRole: auth.session.user.activeRole as UserRole,
              sale: { id: sale.id, branchId: sale.branchId },
              payment: persisted,
            })
          } else if (existing) {
            await reverseSourceCashMovement({
              tx,
              tenantId: sale.tenantId,
              actorUserId: auth.session.user.id,
              actorRole: auth.session.user.activeRole as UserRole,
              sourceType: "SALE_PAYMENT",
              sourceId: existing.id,
              reason: `Pago de venta ${existing.id} convertido a metodo no monetario`,
            })
          }
        }

        for (const existing of sale.payments) {
          if (keptPaymentIds.has(existing.id)) continue
          await reverseSourceCashMovement({
            tx,
            tenantId: sale.tenantId,
            actorUserId: auth.session.user.id,
            actorRole: auth.session.user.activeRole as UserRole,
            sourceType: "SALE_PAYMENT",
            sourceId: existing.id,
            reason: `Pago de venta ${existing.id} eliminado`,
          })
          await tx.payment.delete({ where: { id: existing.id } })
        }
      }

      if (targetStatus === "CONFIRMADA" && !amountPaid.equals(total)) {
        throw new Error(`El total de pagos (${amountPaid.toFixed(2)}) debe coincidir con el total de la venta (${total.toFixed(2)}).`)
      }

      if (targetStatus === "SENADA") {
        if (amountPaid.lessThanOrEqualTo(0)) {
          throw new Error("La sena debe tener al menos un pago mayor a 0.")
        }
        if (amountPaid.greaterThan(total)) {
          throw new Error("La sena no puede superar el total de la venta.")
        }
      }

      saleData.status = targetStatus
      saleData.subtotal = subtotal
      saleData.extraCosts = extraCosts
      saleData.costTotal = costTotal
      saleData.total = total
      saleData.profit = profit
      saleData.amountPaid = amountPaid
      saleData.balanceDue = balanceDue

      const updatedSale = await tx.sale.update({
        where: { id },
        data: saleData,
        include: saleInclude(),
      })

      if (Object.prototype.hasOwnProperty.call(body, "branchId") && sale.branchId !== updatedSale.branchId) {
        await createAuditLog({
          tenantId: sale.tenantId,
          actorUserId: auth.session.user.id,
          actorRole: auth.session.user.activeRole as UserRole,
          action: "UPDATE",
          module: "SALE",
          entityType: "Sale",
          entityId: sale.id,
          detail: `Cambio de sucursal de venta: ${sale.branch?.name ?? "Sin sucursal"} -> ${updatedSale.branch?.name ?? "Sin sucursal"}`,
          oldValue: { branchId: sale.branchId, branchName: sale.branch?.name ?? null },
          newValue: { branchId: updatedSale.branchId, branchName: updatedSale.branch?.name ?? null },
        }, tx)
      }

      return updatedSale
    }, { timeout: 15000, maxWait: 5000 })

    return NextResponse.json({ sale: serializeSale(updated) })
  } catch (e: unknown) {
    const error = e as Error

    if ((error?.message ?? "").toLowerCase().includes("inval")) {
      return NextResponse.json(
        { error: error?.message ?? "PATCH failed" },
        { status: 400 },
      )
    }

    const status =
      error?.message?.includes("solo puede modificarse") ||
      error?.message?.includes("permisos") ||
      error?.message?.includes("Tenant no disponible")
        ? 403
        : error?.message?.includes("no encontrada") ||
            error?.message?.includes("no disponible")
          ? 404
          : error?.message?.includes("inválid") ||
              error?.message?.includes("debe tener") ||
              error?.message?.includes("Stock insuficiente") ||
              error?.message?.includes("stock negativo")
            ? 400
            : 500

    return NextResponse.json(
      { error: error?.message ?? "PATCH failed" },
      { status },
    )
  }
}

function serializeSale(sale: any) {
  return {
    ...sale,
    createdBy: sale.user?.name || sale.user?.email || "-",
    createdByUser: sale.user
      ? {
          id: sale.user.id,
          name: sale.user.name,
          email: sale.user.email ?? "",
        }
      : null,
    subtotal: sale.subtotal != null ? String(sale.subtotal) : null,
    extraCosts: sale.extraCosts != null ? String(sale.extraCosts) : null,
    total: sale.total != null ? String(sale.total) : null,
    profit: sale.profit != null ? String(sale.profit) : null,
    costTotal: sale.costTotal != null ? String(sale.costTotal) : null,
    amountPaid: sale.amountPaid != null ? String(sale.amountPaid) : null,
    balanceDue: sale.balanceDue != null ? String(sale.balanceDue) : null,
    payments: Array.isArray(sale.payments)
      ? sale.payments.map((p: any) => ({
          ...p,
          amount: p.amount != null ? String(p.amount) : null,
          exchangeRate: p.exchangeRate != null ? String(p.exchangeRate) : null,
          amountUsd: p.amountUsd != null ? String(p.amountUsd) : null,
          cashAccountId: p.cashAccountId ?? null,
          originReservationPaymentId: p.originReservationPaymentId ?? null,
        }))
      : [],
    items: Array.isArray(sale.items)
      ? sale.items.map((item: any) => ({
          ...item,
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
          unitCost: item.unitCost != null ? String(item.unitCost) : null,
          extraCost: item.extraCost != null ? String(item.extraCost) : null,
          lineTotal: item.lineTotal != null ? String(item.lineTotal) : null,
          lineCost: item.lineCost != null ? String(item.lineCost) : null,
          lineProfit: item.lineProfit != null ? String(item.lineProfit) : null,
          product: item.product
            ? {
                ...item.product,
                costPrice:
                  item.product.costPrice != null
                    ? String(item.product.costPrice)
                    : null,
                salePrice:
                  item.product.salePrice != null
                    ? String(item.product.salePrice)
                    : null,
                shippingCost:
                  item.product.shippingCost != null
                    ? String(item.product.shippingCost)
                    : null,
              }
            : item.product,
        }))
      : [],
  }
}
