import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/sales/search?q=term
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  // Build a flexible where clause that searches customerName and id,
  // and also attempts to match by date if the query looks like a date.
  const where: any = {}
  if (q) {
    const or: any[] = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { id: { contains: q } },
    ]
    // Try parse date-like queries (ISO or simple YYYY-MM-DD)
    const parsed = Date.parse(q)
    if (!Number.isNaN(parsed)) {
      const iso = new Date(parsed).toISOString()
      or.push({ date: { equals: new Date(parsed) } })
    }
    where.OR = or
  }

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
