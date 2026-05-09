import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client";
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
