// src/app/api/wholesale-orders/[id]/route.ts
import prisma from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

/**
 * API para obtener, actualizar o eliminar un pedido mayorista por ID.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  const order = await prisma.wholesaleOrder.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: "Pedido mayorista no encontrado" }, { status: 404 })
  }
  return NextResponse.json(order)
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()

  try {
    const order = await prisma.wholesaleOrder.update({ where: { id }, data: body })
    return NextResponse.json(order)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error actualizando pedido mayorista" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    await prisma.wholesaleOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error eliminando pedido mayorista" }, { status: 500 })
  }
}