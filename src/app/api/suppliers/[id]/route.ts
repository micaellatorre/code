import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

// GET: proveedor por ID
export async function GET(_req: Request, { params }: Params) {
  const supplier = await prisma.supplier.findUnique({ where: { id: params.id } })
  if (!supplier) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }
  return NextResponse.json(supplier)
}

// PUT: actualiza proveedor
export async function PUT(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const supplier = await prisma.supplier.update({ where: { id: params.id }, data: body })
    return NextResponse.json(supplier)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando proveedor' }, { status: 500 })
  }
}

// DELETE: elimina proveedor
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.supplier.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando proveedor' }, { status: 500 })
  }
}