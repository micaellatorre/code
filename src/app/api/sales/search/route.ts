import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireRoleApi } from '@/lib/auth/auth'

// GET /api/sales/search?q=term
export async function GET(req: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  const orClauses: Prisma.SaleWhereInput['OR'] = []

  if (q) {
    orClauses.push(
      { customerName: { contains: q, mode: 'insensitive' } },
      { buyer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { buyer: { is: { surname: { contains: q, mode: 'insensitive' } } } },
      { user: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
      { id: { contains: q } }
    )
    // Try parse date-like queries (ISO or simple YYYY-MM-DD)
    const parsed = Date.parse(q)
    if (!Number.isNaN(parsed)) {
      orClauses.push({ date: { equals: new Date(parsed) } })
    }
  }

  const where: Prisma.SaleWhereInput = q && orClauses.length > 0 ? { OR: orClauses } : {}

  const results = await prisma.sale.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      buyer: { select: { name: true, surname: true } },
      payments: { select: { method: true }, orderBy: { paidAt: 'asc' } },
      items: {
        include: {
          product: {
            select: {
              modelName: true,
              type: true,
              capacityGB: true,
              imei: true,
              costPrice: true,
              salePrice: true,
              shippingCost: true,
            },
          },
        },
      },
    },
  })

  const serialized = results.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    date: s.date ? s.date.toISOString() : null,
    customerName: s.customerName,
    origin: s.origin,
    payment: s.payments.length > 0 ? s.payments[0].method : null,
    notes: s.notes,
    status: s.status,
    amountPaid: s.amountPaid != null ? String(s.amountPaid) : null,
    balanceDue: s.balanceDue != null ? String(s.balanceDue) : null,
    subtotal: s.subtotal != null ? String(s.subtotal) : null,
    extraCosts: s.extraCosts != null ? String(s.extraCosts) : null,
    total: s.total != null ? String(s.total) : null,
    profit: s.profit != null ? String(s.profit) : null,
    costTotal: s.costTotal != null ? String(s.costTotal) : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
    createdBy: s.user?.name || s.user?.email || '-',
    createdByUser: s.user
      ? {
        id: s.user.id,
        name: s.user.name,
        email: s.user.email ?? '',
      }
      : null,
    buyer: s.buyer ? { name: s.buyer.name, surname: s.buyer.surname } : null,
    items: s.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      units: item.units,
      kind: item.kind,
      parentItemId: item.parentItemId,
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
      unitCost: item.unitCost != null ? String(item.unitCost) : null,
      extraCost: item.extraCost != null ? String(item.extraCost) : null,
      lineTotal: item.lineTotal != null ? String(item.lineTotal) : null,
      lineCost: item.lineCost != null ? String(item.lineCost) : null,
      lineProfit: item.lineProfit != null ? String(item.lineProfit) : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      product: {
        modelName: item.product.modelName,
        type: typeof item.product.type === 'string' ? item.product.type.toUpperCase() : item.product.type,
        capacityGB: item.product.capacityGB,
        imei: item.product.imei,
        costPrice: item.product.costPrice != null ? String(item.product.costPrice) : null,
        salePrice: item.product.salePrice != null ? String(item.product.salePrice) : null,
        shippingCost: item.product.shippingCost ? String(item.product.shippingCost) : null,
      },
    })),
  }))

  return NextResponse.json({ results: serialized })
}
