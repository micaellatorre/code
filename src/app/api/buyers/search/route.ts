// src/app/api/buyers/search/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await prisma.buyer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { surname: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { instagram: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { cuit: { contains: q, mode: 'insensitive' } },
          { dni: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 50, // Limitar resultados
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Buyer search failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}