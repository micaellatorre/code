// src/app/api/suppliers/[id]/route.ts
import prisma from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

// GET: proveedor por ID
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
  }
  return NextResponse.json(supplier)
}

// PUT: actualiza proveedor
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()

  try {
    const supplier = await prisma.supplier.update({ where: { id }, data: body })
    return NextResponse.json(supplier)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error actualizando proveedor" }, { status: 500 })
  }
}

// DELETE: elimina proveedor
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error eliminando proveedor" }, { status: 500 })
  }
}