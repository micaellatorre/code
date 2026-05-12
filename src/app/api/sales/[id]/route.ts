import { NextRequest, NextResponse } from "next/server"
import { Prisma, ProductState, SaleItemKind } from "@prisma/client";
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"

export const runtime = "nodejs"

const DECIMAL_FIELDS = new Set(["subtotal", "extraCosts", "total", "profit", "costTotal", "amountPaid", "balanceDue"])
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
])

type Ctx = { params: Promise<{ id: string }> }

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
  if (stock < 1) return type === "PHONE" ? "VENDIDO" as ProductState : "FUERA_DE_STOCK" as ProductState
  if (state === ("VENDIDO" as ProductState) || state === "FUERA_DE_STOCK") return "EN_STOCK"
  return state
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
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
      await tx.saleItem.deleteMany({ where: { saleId: id } }).catch(() => {})
      await tx.sale.delete({ where: { id } })
    })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error?.message ?? "DELETE failed" }, { status: 500 })
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
  if (keys.length === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 })
  if (!keys.every((k) => ALLOWED_FIELDS.has(k))) {
    return NextResponse.json({ error: "Some fields are not allowed" }, { status: 400 })
  }

  const currentSale = await prisma.sale.findUnique({
    where: { id },
    select: { id: true, status: true },
  })

  if (!currentSale) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  }

  if (currentSale.status === "CONFIRMADA" && auth.session.user.activeRole !== "ADMIN") {
    return NextResponse.json(
      { error: "La venta confirmada solo puede modificarse con rol activo ADMIN." },
      { status: 403 },
    )
  }

  if (Object.prototype.hasOwnProperty.call(body, "buyerId")) {
    const buyerId = body.buyerId == null || String(body.buyerId).trim() === "" ? null : String(body.buyerId).trim()

    try {
      const sale = await prisma.sale.findUnique({
        where: { id },
        select: { id: true, tenantId: true },
      })

      if (!sale) {
        return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
      }

      if (!buyerId) {
        const updated = await prisma.sale.update({
          where: { id },
          data: { buyerId: null, customerName: null },
          include: saleInclude(),
        })
        return NextResponse.json({ sale: serializeSale(updated) })
      }

      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId: sale.tenantId },
        select: { id: true, name: true, surname: true },
      })

      if (!buyer) {
        return NextResponse.json({ error: "Comprador no disponible" }, { status: 404 })
      }

      const updated = await prisma.sale.update({
        where: { id },
        data: {
          buyerId: buyer.id,
          customerName: [buyer.name, buyer.surname].filter(Boolean).join(" ") || null,
        },
        include: saleInclude(),
      })
      return NextResponse.json({ sale: serializeSale(updated) })
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json({ error: error?.message ?? "PATCH buyer failed" }, { status: 500 })
    }
  }

  if (Array.isArray(body.items)) {
    const items = body.items as SaleItemInput[]

    if (items.length === 0) {
      return NextResponse.json({ error: "La venta debe tener al menos un item" }, { status: 400 })
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          include: { items: true },
        })

        if (!sale) {
          throw new Error("Venta no encontrada")
        }

        const productIds = Array.from(new Set(items.map((item) => String(item.productId))))
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, tenantId: sale.tenantId },
          select: {
            id: true,
            type: true,
            modelName: true,
            costPrice: true,
            stock: true,
            stockAvailable: true,
            state: true,
          },
        })
        const productMap = new Map(products.map((product) => [product.id, product]))

        const oldUnitsByProduct = new Map<string, number>()
        for (const item of sale.items) {
          oldUnitsByProduct.set(item.productId, (oldUnitsByProduct.get(item.productId) ?? 0) + item.units)
        }

        const newUnitsByProduct = new Map<string, number>()
        let subtotal = new Prisma.Decimal(0)
        let costTotal = new Prisma.Decimal(0)
        let extraCosts = new Prisma.Decimal(0)

        const itemCreates = items.map((raw) => {
          const productId = String(raw.productId)
          const product = productMap.get(productId)
          if (!product) {
            throw new Error(`No se encontrÃ³ el producto ${productId}`)
          }

          const unitsNum = Number(raw.units)
          if (!Number.isInteger(unitsNum) || unitsNum < 1) {
            throw new Error(`Cantidad invÃ¡lida para ${product.modelName}`)
          }

          newUnitsByProduct.set(productId, (newUnitsByProduct.get(productId) ?? 0) + unitsNum)

          const units = new Prisma.Decimal(unitsNum)
          const unitPrice = decimal(raw.unitPrice)
          const unitCost = decimal(raw.unitCost ?? product.costPrice)
          const extraCost = decimal(raw.extraCost)
          const lineTotal = raw.kind === "NORMAL" ? unitPrice.mul(units) : new Prisma.Decimal(0)
          const lineCost = unitCost.add(extraCost).mul(units)
          const lineProfit = lineTotal.sub(lineCost)

          if (raw.kind === "NORMAL") {
            subtotal = subtotal.add(lineTotal)
          } else if (raw.kind === "IN_TOTAL") {
            extraCosts = extraCosts.add(lineCost)
          }
          costTotal = costTotal.add(lineCost)

          return {
            saleId: id,
            productId,
            kind: raw.kind as SaleItemKind,
            units: unitsNum,
            unitPrice,
            unitCost,
            extraCost,
            lineTotal,
            lineCost,
            lineProfit,
          }
        })

        if (sale.status === "CONFIRMADA") {
          for (const [productId, newUnits] of newUnitsByProduct) {
            const product = productMap.get(productId)!
            const oldUnits = oldUnitsByProduct.get(productId) ?? 0
            const availableForSale = product.stockAvailable + oldUnits
            if (newUnits > availableForSale) {
              throw new Error(`Stock insuficiente para ${product.modelName}. Disponible: ${availableForSale}`)
            }
          }
        }

        await tx.saleItem.deleteMany({ where: { saleId: id } })

        for (const item of itemCreates) {
          await tx.saleItem.create({ data: item })
        }

        if (sale.status === "CONFIRMADA") {
          const touchedProductIds = new Set([...oldUnitsByProduct.keys(), ...newUnitsByProduct.keys()])
          for (const productId of touchedProductIds) {
            const oldUnits = oldUnitsByProduct.get(productId) ?? 0
            const newUnits = newUnitsByProduct.get(productId) ?? 0
            const delta = newUnits - oldUnits
            if (delta === 0) continue

            const product = productMap.get(productId) ?? await tx.product.findUnique({
              where: { id: productId },
              select: { id: true, type: true, stock: true, stockAvailable: true, state: true },
            })
            if (!product) continue

            const stock = product.stock - delta
            const stockAvailable = product.stockAvailable - delta
            if (stock < 0 || stockAvailable < 0) {
              throw new Error("El ajuste deja stock negativo")
            }

            await tx.product.update({
              where: { id: productId },
              data: {
                stock,
                stockAvailable,
                state: nextProductState(product.type, stock, product.state),
              },
            })
          }
        }

        const total = subtotal.add(extraCosts)
        const profit = total.sub(costTotal)
        const amountPaid = sale.amountPaid ?? new Prisma.Decimal(0)

        return tx.sale.update({
          where: { id },
          data: {
            subtotal,
            extraCosts,
            costTotal,
            total,
            profit,
            balanceDue: total.sub(amountPaid),
          },
          include: saleInclude(),
        })
      })

      return NextResponse.json({ sale: serializeSale(updated) })
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json({ error: error?.message ?? "PATCH items failed" }, { status: 500 })
    }
  }

  const buyerObj = body.buyer as Record<string, string> | undefined
  if (buyerObj && typeof buyerObj === "object") {
    const name = (buyerObj.name ?? "").trim()
    const surname = (buyerObj.surname ?? "").trim()

    try {
      const updated = await prisma.sale.update({
        where: { id },
        data: {
          customerName: [name, surname].filter(Boolean).join(" ") || null,
          buyer: {
            upsert: {
              update: { name, surname: surname || null },
              create: {
                tenantId: process.env.DEFAULT_TENANT_ID as string,
                name: name as string,
                surname: (surname as string) || null,
              },
            },
          },
        },
        include: saleInclude(),
      })
      return NextResponse.json({ sale: serializeSale(updated) })
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json({ error: error?.message ?? "PATCH failed" }, { status: 500 })
    }
  }

  if (Array.isArray(body.payments)) {
    const payments = body.payments as PaymentInput[]

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          select: { id: true, total: true },
        })

        if (!sale) {
          throw new Error("Venta no encontrada")
        }

        const paymentsData = payments.map((payment) => {
          const amount = toDecimal(payment.amount)

          if (!amount || amount.lessThan(0)) {
            throw new Error("Monto de pago inválido")
          }

          if (!payment.method || !payment.currency) {
            throw new Error("Cada pago debe tener método y moneda")
          }

          return {
            method: payment.method as any,
            currency: payment.currency as any,
            amount,
            note: payment.note || null,
            paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
          }
        })

        const amountPaid = paymentsData.reduce(
          (acc, payment) => acc.add(payment.amount),
          new Prisma.Decimal(0),
        )
        const balanceDue = sale.total.sub(amountPaid)

        await tx.payment.deleteMany({ where: { saleId: id } })

        return tx.sale.update({
          where: { id },
          data: {
            amountPaid,
            balanceDue,
            payments: {
              create: paymentsData,
            },
          },
          include: saleInclude(),
        })
      })

      return NextResponse.json({ sale: serializeSale(updated) })
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json({ error: error?.message ?? "PATCH payments failed" }, { status: 500 })
    }
  }

  const data: Record<string, unknown> = {}
  for (const k of keys) {
    const v = body[k]
    if (k === "userId") {
      if (v == null || String(v).trim() === "") {
        data[k] = null
        continue
      }

      const tenantId = auth.session.user.tenantId
      if (!tenantId) {
        return NextResponse.json({ error: "Tenant no disponible para el usuario autenticado" }, { status: 403 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: String(v).trim() },
        select: { id: true, tenantId: true },
      })

      if (!targetUser || targetUser.tenantId !== tenantId) {
        return NextResponse.json({ error: "Usuario no disponible" }, { status: 404 })
      }

      data[k] = targetUser.id
      continue
    }
    if (DECIMAL_FIELDS.has(k)) {
      data[k] = toDecimal(v)
      continue
    }
    if (k === "date") {
      data[k] = v == null ? null : new Date(v as string | number)
      continue
    }
    data[k] = v ?? null
  }

  try {
    const updated = await prisma.sale.update({
      where: { id },
      data,
      include: saleInclude(),
    })
    return NextResponse.json({ sale: serializeSale(updated) })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error?.message ?? "PATCH failed" }, { status: 500 })
  }
}

function saleInclude() {
  return {
    buyer: true,
    user: { select: { id: true, name: true, email: true } },
    items: { include: { product: true } },
    payments: { orderBy: { paidAt: "asc" as const } },
  }
}

type PaymentInput = {
  method?: string
  currency?: string
  amount?: string | number
  note?: string | null
  paidAt?: string | Date | null
}

type SaleItemInput = {
  productId?: string
  kind?: string
  units?: number | string
  unitPrice?: string | number
  unitCost?: string | number | Prisma.Decimal | null
  extraCost?: string | number | Prisma.Decimal | null
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
                costPrice: item.product.costPrice != null ? String(item.product.costPrice) : null,
                salePrice: item.product.salePrice != null ? String(item.product.salePrice) : null,
                shippingCost: item.product.shippingCost != null ? String(item.product.shippingCost) : null,
              }
            : item.product,
        }))
      : [],
  }
}
