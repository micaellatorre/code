import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

// GET: obtener una venta con items
export async function GET(_req: Request, { params }: Params) {
  const sale = await prisma.sale.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } },
  })
  if (!sale) {
    return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
  }
  return NextResponse.json(sale)
}

// DELETE: eliminar venta (no ajusta stock)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.sale.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando venta' }, { status: 500 })
  }
}

// PATCH: actualizar campos editables de la venta (inline edits)
export async function PATCH(req: Request, { params }: Params) {
  let body: any
  try {
    body = await req.json()
  } catch (err) {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // Only allow specific fields from the client
  const allowed: Record<string, boolean> = { customerName: true, total: true, profit: true, origin: true, payment: true, extraCosts: true }
  const data: any = {}
  for (const k of Object.keys(body || {})) {
    if (!allowed[k]) continue
    const v = body[k]
    if (k === 'customerName') data.customerName = v == null ? null : String(v)
    if (k === 'total') data.total = v == null ? null : Number(v)
    if (k === 'profit') data.profit = v == null ? null : Number(v)
    if (k === 'origin') data.origin = v == null ? null : String(v)
    if (k === 'payment') data.payment = v == null ? null : String(v)
    if (k === 'extraCosts') {
      if (v == null) data.extraCosts = null
      else {
        const n = Number(v)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'extraCosts inválido' }, { status: 400 })
        data.extraCosts = n
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  try {
    const sale = await prisma.sale.update({
      where: { id: params.id },
      data,
      include: { items: { include: { product: true } } },
    })

    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })

    // Serialize Decimal and Date fields to strings for client
    const serialized = {
      ...sale,
      date: sale.date ? sale.date.toISOString() : null,
      subtotal: sale.subtotal != null ? String(sale.subtotal) : null,
      extraCosts: sale.extraCosts != null ? String(sale.extraCosts) : null,
      total: sale.total != null ? String(sale.total) : null,
      profit: sale.profit != null ? String(sale.profit) : null,
      createdAt: sale.createdAt ? sale.createdAt.toISOString() : null,
      items: sale.items?.map((it) => ({
        ...it,
        unitPrice: it.unitPrice != null ? String(it.unitPrice) : null,
        unitCost: it.unitCost != null ? String(it.unitCost) : null,
        extraCost: it.extraCost != null ? String(it.extraCost) : null,
        lineTotal: it.lineTotal != null ? String(it.lineTotal) : null,
        lineCost: it.lineCost != null ? String(it.lineCost) : null,
        lineProfit: it.lineProfit != null ? String(it.lineProfit) : null,
      })),
    }

    return NextResponse.json({ success: true, sale: serialized })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando venta' }, { status: 500 })
  }
}