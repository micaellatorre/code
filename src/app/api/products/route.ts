import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * API para listar y crear productos.
 */
export async function GET() {
  const products = await prisma.product.findMany()
  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const body = await request.json()
  try {
    // If tenant isn't provided (no auth yet), fall back to the default tenant id
    const data = { ...body, tenantId: (body.tenantId ?? 'cmh3grger0000hhx0cy3w32rk') }
    const product = await prisma.product.create({ data })
    return NextResponse.json(product, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando producto' }, { status: 500 })
  }
}