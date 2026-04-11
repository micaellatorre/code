import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/auth'

/**
 * API para listar y crear pedidos mayoristas (WholesaleOrder).
 */
export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const orders = await prisma.wholesaleOrder.findMany({
    orderBy: { requestedAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const body = await request.json()
  try {
    const order = await prisma.wholesaleOrder.create({ data: body })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando pedido mayorista' }, { status: 500 })
  }
}
