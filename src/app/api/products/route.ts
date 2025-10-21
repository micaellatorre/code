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
    const product = await prisma.product.create({ data: body })
    return NextResponse.json(product, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando producto' }, { status: 500 })
  }
}