import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET: lista de ventas con items
export async function GET() {
  const sales = await prisma.sale.findMany({
    include: { items: { include: { product: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(sales)
}

// POST: crea una venta y sus items, actualiza stock
export async function POST(request: Request) {
  const body = await request.json()
  const { customerName, origin, payment, notes, items } = body
  try {
    const result = await prisma.$transaction(async (tx) => {
      // use a default tenant for now (single-tenant MVP). If none exists, return error.
      const tenant = await tx.tenant.findFirst()
      if (!tenant) throw new Error('No tenant found')
      // calcular subtotal, extraCosts, profit
      let subtotal = 0
      let costTotal = 0
      for (const item of items) {
        subtotal += item.units * item.unitPrice
        costTotal += item.units * (item.unitCost + (item.extraCost ?? 0))
      }
      const sale = await tx.sale.create({
        data: {
          tenantId: tenant.id,
          customerName: customerName ?? null,
          origin: origin ?? null,
          payment: payment ?? null,
          notes: notes ?? null,
          subtotal,
          extraCosts: 0,
          total: subtotal,
          profit: subtotal - costTotal,
        },
      })
      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            units: item.units,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            extraCost: item.extraCost ?? 0,
            lineTotal: item.units * item.unitPrice,
            lineCost: item.units * (item.unitCost + (item.extraCost ?? 0)),
            lineProfit:
              item.units * item.unitPrice -
              item.units * (item.unitCost + (item.extraCost ?? 0)),
          },
        })
        // descontar stock del producto
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.units } },
        })
      }
      return sale
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando venta' }, { status: 500 })
  }
}