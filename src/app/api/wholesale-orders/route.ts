import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * API para listar y crear pedidos mayoristas (WholesaleOrder).
 */
export async function GET() {
  const orders = await prisma.wholesaleOrder.findMany({
    orderBy: { requestedAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  const body = await request.json()
  try {
    const order = await prisma.wholesaleOrder.create({ data: body })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando pedido mayorista' }, { status: 500 })
  }
}