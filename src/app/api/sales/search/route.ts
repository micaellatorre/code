import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/sales/search?q=term
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  const orClauses: Prisma.SaleWhereInput['OR'] = []

  if (q) {
    orClauses.push(
      { customerName: { contains: q, mode: 'insensitive' } },
      { id: { contains: q } }
    )
    // Try parse date-like queries (ISO or simple YYYY-MM-DD)
    const parsed = Date.parse(q)
    if (!Number.isNaN(parsed)) {
      orClauses.push({ date: { equals: new Date(parsed) } })
    }
  }

  const where: Prisma.SaleWhereInput = q && orClauses.length > 0 ? { OR: orClauses } : {}

  const results = await prisma.sale.findMany({ where, orderBy: { date: 'desc' }, take: 200 })

  const serialized = results.map((s) => ({
    ...s,
    date: s.date ? s.date.toISOString() : null,
    subtotal: s.subtotal != null ? String(s.subtotal) : null,
    extraCosts: s.extraCosts != null ? String(s.extraCosts) : null,
    total: s.total != null ? String(s.total) : null,
    profit: s.profit != null ? String(s.profit) : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
  }))

  return NextResponse.json({ results: serialized })
}
