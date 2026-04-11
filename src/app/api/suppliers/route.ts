import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/auth'

// GET: lista de proveedores
export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(suppliers)
}

// POST: crea un proveedor
export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const body = await request.json()
  try {
    const supplier = await prisma.supplier.create({ data: body })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando proveedor' }, { status: 500 })
  }
}
