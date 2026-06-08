// code/src/app/api/sales/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { Prisma, ProductState, SaleItemKind, SaleStatus } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"

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
  "operationType",
  "appointmentId",
  "operationFlow",
  "tradeInDevices",
])

type Ctx = { params: Promise<{ id: string }> }

type PaymentInput = {
  method?: string
  currency?: string
  amount?: string | number | Prisma.Decimal | null
  note?: string | null
  paidAt?: string | Date | null
}

type SaleItemInput = {
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

function saleInclude() {
  return {
    buyer: true,
    user: { select: { id: true, name: true, email: true } },
    items: { include: { product: true } },
    payments: { orderBy: { paidAt: "asc" as const } },
  }
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params

  const sale = await prisma.sale.findUnique({
    where: { id },
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { saleId: id } })
      await tx.saleItem.deleteMany({ where: { saleId: id } })
      await tx.sale.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
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
          items: true,
          payments: true,
        },
      })

      if (!sale) {
        throw new Error("Venta no encontrada")
      }

      if (
        sale.status === "CONFIRMADA" &&
        auth.session.user.activeRole !== "ADMIN"
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

      const itemCreates = incomingItems.map((raw) => {
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

        for (const itemCreate of itemCreates) {
          await tx.saleItem.create({
            data: itemCreate,
          })
        }
      }

      const total = subtotal.add(extraCosts)
      const profit = total.sub(costTotal)

      let amountPaid = sale.amountPaid ?? new Prisma.Decimal(0)
      let balanceDue = total.sub(amountPaid)

      if (Array.isArray(body.payments)) {
        const payments = body.payments as PaymentInput[]

        const paymentsData = payments.map((payment) => {
          const amount = toDecimal(payment.amount)

          if (!amount || amount.lessThan(0)) {
            throw new Error("Monto de pago inválido")
          }

          if (!payment.method || !payment.currency) {
            throw new Error("Cada pago debe tener método y moneda")
          }

          return {
            saleId: id,
            method: payment.method as any,
            currency: payment.currency as any,
            amount,
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

        await tx.payment.deleteMany({ where: { saleId: id } })

        for (const paymentData of paymentsData) {
          await tx.payment.create({
            data: paymentData,
          })
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

      return updatedSale
    })

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
