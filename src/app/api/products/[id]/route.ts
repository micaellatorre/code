import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

/**
 * API para obtener, actualizar o eliminar un producto por ID.
 */
export async function GET(_req: Request, { params }: Params) {
  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  return NextResponse.json(product)
}

export async function PUT(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const product = await prisma.product.update({ where: { id: params.id }, data: body })
    return NextResponse.json(product)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando producto' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando producto' }, { status: 500 })
  }
}