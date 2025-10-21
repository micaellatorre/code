import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

/**
 * API para obtener, actualizar o eliminar un pedido mayorista por ID.
 */
export async function GET(_req: Request, { params }: Params) {
  const order = await prisma.wholesaleOrder.findUnique({ where: { id: params.id } })
  if (!order) {
    return NextResponse.json({ error: 'Pedido mayorista no encontrado' }, { status: 404 })
  }
  return NextResponse.json(order)
}

export async function PUT(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const order = await prisma.wholesaleOrder.update({ where: { id: params.id }, data: body })
    return NextResponse.json(order)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando pedido mayorista' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.wholesaleOrder.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando pedido mayorista' }, { status: 500 })
  }
}