import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Debug detallado en dev
const DEBUG = process.env.NODE_ENV !== 'production'
const dbg = (...args: any[]) => { if (DEBUG) console.log('[sales/[id]]', ...args) }

type Params = { params: { id: string } }

/* ===========================
   Schemas Zod
=========================== */

// PATCH simple (shape plano que manda la tabla) + buyer
const FlatPatchSchema = z.object({
  customerName: z.string().trim().max(200).nullable().optional(),
  origin: z.string().trim().max(100).nullable().optional(),
  date: z.union([z.string().datetime(), z.string().length(10), z.null()]).optional(), // ISO o 'YYYY-MM-DD' o null
  total: z.union([z.number(), z.string()]).optional(),
  profit: z.union([z.number(), z.string()]).optional(),
  extraCosts: z.union([z.number(), z.string()]).optional(),
  buyer: z.object({
    name: z.string().trim().max(200).nullable().optional(),
    surname: z.string().trim().max(200).nullable().optional(),
  }).optional(),
}).strict()

// PATCH avanzado (sale/items/payments) + buyer opcional
const AdvancedPatchSchema = z.object({
  sale: z.object({
    customerName: z.string().trim().max(200).nullable().optional(),
    origin: z.string().trim().max(100).nullable().optional(),
    date: z.string().datetime().nullable().optional(),
    total: z.coerce.number().finite().optional(),
    profit: z.coerce.number().finite().optional(),
    extraCosts: z.coerce.number().finite().optional(),
  }).partial().optional(),

  items: z.array(
    z.discriminatedUnion('action', [
      z.object({
        action: z.literal('create'),
        data: z.object({
          productId: z.string().min(1),
          units: z.coerce.number().int().positive(),
          unitPrice: z.coerce.number().finite(),
          unitCost: z.coerce.number().finite(),
          extraCost: z.coerce.number().finite().optional().default(0),
          kind: z.enum(['NORMAL','ZERO_COST','IN_TOTAL']).optional().default('NORMAL'),
          parentItemId: z.string().optional(),
        }),
      }),
      z.object({
        action: z.literal('update'),
        id: z.string().min(1),
        data: z.object({
          units: z.coerce.number().int().positive().optional(),
          unitPrice: z.coerce.number().finite().optional(),
          unitCost: z.coerce.number().finite().optional(),
          extraCost: z.coerce.number().finite().optional(),
          kind: z.enum(['NORMAL','ZERO_COST','IN_TOTAL']).optional(),
          parentItemId: z.string().nullable().optional(),
        }).refine(d => Object.keys(d).length > 0, { message: 'Nada para actualizar en el item' }),
      }),
      z.object({
        action: z.literal('delete'),
        id: z.string().min(1),
      }),
    ])
  ).optional(),

  payments: z.array(
    z.discriminatedUnion('action', [
      z.object({
        action: z.literal('create'),
        data: z.object({
          method: z.enum(['EFECTIVO_PESOS','EFECTIVO_USD','TRANSFERENCIA_ARS','TRANSFERENCIA_USD','TARJETA','USDT']),
          amount: z.coerce.number().finite().nonnegative(),
          currency: z.enum(['ARS','USD','USDT']).optional().default('USD'),
          note: z.string().trim().max(300).nullable().optional(),
          paidAt: z.string().datetime().optional(),
        }),
      }),
      z.object({
        action: z.literal('update'),
        id: z.string().min(1),
        data: z.object({
          method: z.enum(['EFECTIVO_PESOS','EFECTIVO_USD','TRANSFERENCIA_ARS','TRANSFERENCIA_USD','TARJETA','USDT']).optional(),
          amount: z.coerce.number().finite().nonnegative().optional(),
          currency: z.enum(['ARS','USD','USDT']).optional(),
          note: z.string().trim().max(300).nullable().optional(),
          paidAt: z.string().datetime().optional(),
        }).refine(d => Object.keys(d).length > 0, { message: 'Nada para actualizar en el pago' }),
      }),
      z.object({
        action: z.literal('delete'),
        id: z.string().min(1),
      }),
    ])
  ).optional(),

  buyer: z.object({
    name: z.string().trim().max(200).nullable().optional(),
    surname: z.string().trim().max(200).nullable().optional(),
  }).optional(),

  enforceBalance: z.boolean().optional(),
}).strict()

/* ===========================
   Helpers
=========================== */

const toDec = (n: any): Decimal => new Decimal(n ?? 0)

function toISODateLike(input: string | null): Date | undefined {
  if (!input) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00.000Z`)
  const d = new Date(input)
  return isNaN(d.getTime()) ? undefined : d
}

function computeLine(kind: string, units: number, unitPrice: Decimal, unitCost: Decimal, extra: Decimal) {
  const u = new Decimal(units)
  const lineTotal = kind === 'NORMAL' ? u.mul(unitPrice) : new Decimal(0)
  const lineCost  = u.mul(unitCost.plus(extra))
  const lineProfit = lineTotal.minus(lineCost)
  return { lineTotal, lineCost, lineProfit }
}

function computeTotals(items: Array<{ kind: string; units: number; unitPrice: Decimal; unitCost: Decimal; extraCost: Decimal }>) {
  let subtotal = new Decimal(0)
  let extraCosts = new Decimal(0)
  let costTotal = new Decimal(0)
  for (const it of items) {
    const u = new Decimal(it.units)
    if (it.kind === 'NORMAL') subtotal = subtotal.plus(u.mul(it.unitPrice))
    if (it.kind === 'IN_TOTAL') extraCosts = extraCosts.plus(u.mul(it.unitCost.plus(it.extraCost)))
    costTotal = costTotal.plus(u.mul(it.unitCost.plus(it.extraCost)))
  }
  const total = subtotal.plus(extraCosts)
  const profit = total.minus(costTotal)
  return { subtotal, extraCosts, costTotal, total, profit }
}

const concatName = (name?: string | null, surname?: string | null) =>
  [name ?? '', surname ?? ''].join(' ').trim() || null

/* ===========================
   GET
=========================== */
export async function GET(_req: Request, { params }: Params) {
  const sale = await prisma.sale.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, surname: true } },
      items: { include: { product: true } },
      payments: true,
    },
  })
  if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
  return NextResponse.json(sale, { status: 200 })
}

/* ===========================
   PATCH (acepta plano o avanzado) + buyer
=========================== */
export async function PATCH(req: Request, { params }: Params) {
  let raw: any
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const isAdvanced = raw && (raw.sale || raw.items || raw.payments || raw.buyer)
  dbg('PATCH body received:', raw, 'isAdvanced=', isAdvanced)

  // ---------- MODO AVANZADO ----------
  if (isAdvanced) {
    const parsed = AdvancedPatchSchema.safeParse(raw)
    if (!parsed.success) {
      if (DEBUG) dbg('Advanced schema error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request (advanced)', details: parsed.error.flatten() }, { status: 400 })
    }

    const { sale: salePatch, items: itemsOps, payments: paymentOps, buyer: buyerPatch, enforceBalance } = parsed.data

    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.sale.findUnique({
          where: { id: params.id },
          include: { items: true, payments: true, buyer: true },
        })
        if (!current) throw new Error('Sale not found')

        // ===== Buyer =====
        let saleData: any = {}
        if (buyerPatch) {
          const name = (buyerPatch.name ?? '').trim()
          const surname = (buyerPatch.surname ?? '').trim()

          if (current.buyerId) {
            // update buyer existente
            await tx.buyer.update({
              where: { id: current.buyerId },
              data: {
                name: name === '' ? null : name as string | any,
                surname: surname === '' ? null : surname,
              },
            })
          } else {
            // crear buyer y linkear a la sale
            const created = await tx.buyer.create({
              data: {
                tenantId: current.tenantId,
                name: name === '' ? null : name as string | any,
                surname: surname === '' ? null : surname,
              },
            })
            saleData.buyerId = created.id
          }

          // actualizar siempre customerName con la concatenación
          saleData.customerName = concatName(name, surname)
        }

        // ===== ITEMS (igual que antes) =====
        if (itemsOps?.length) {
          for (const op of itemsOps) {
            if (op.action === 'create') {
              const { productId, units, unitPrice, unitCost, extraCost = 0, kind = 'NORMAL', parentItemId } = op.data
              const up = toDec(unitPrice), uc = toDec(unitCost), ex = toDec(extraCost)
              const { lineTotal, lineCost, lineProfit } = computeLine(kind, units, up, uc, ex)
              await tx.saleItem.create({
                data: {
                  saleId: current.id,
                  productId, units, kind: kind as any,
                  parentItemId: parentItemId ?? null,
                  unitPrice: up, unitCost: uc, extraCost: ex,
                  lineTotal, lineCost, lineProfit,
                },
              })
              await tx.product.update({ where: { id: productId }, data: { stock: { decrement: units } } })
            }
            if (op.action === 'update') {
              const it = await tx.saleItem.findUnique({ where: { id: op.id } })
              if (!it || it.saleId !== current.id) throw new Error('SaleItem not found or mismatched')
              const nextUnits = op.data.units ?? it.units
              const nextKind  = (op.data.kind ?? it.kind) as any
              const up = toDec(op.data.unitPrice ?? it.unitPrice)
              const uc = toDec(op.data.unitCost ?? it.unitCost)
              const ex = toDec(op.data.extraCost ?? it.extraCost)
              if (op.data.units && op.data.units !== it.units) {
                const delta = op.data.units - it.units
                if (delta > 0) await tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: delta } } })
                if (delta < 0) await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: -delta } } })
              }
              const { lineTotal, lineCost, lineProfit } = computeLine(nextKind, nextUnits, up, uc, ex)
              await tx.saleItem.update({
                where: { id: it.id },
                data: {
                  units: nextUnits, kind: nextKind,
                  unitPrice: up, unitCost: uc, extraCost: ex,
                  parentItemId: op.data.parentItemId ?? it.parentItemId,
                  lineTotal, lineCost, lineProfit,
                },
              })
            }
            if (op.action === 'delete') {
              const it = await tx.saleItem.findUnique({ where: { id: op.id } })
              if (!it || it.saleId !== current.id) throw new Error('SaleItem not found or mismatched')
              await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.units } } })
              await tx.saleItem.delete({ where: { id: it.id } })
            }
          }
        }

        // ===== PAYMENTS =====
        if (paymentOps?.length) {
          for (const op of paymentOps) {
            if (op.action === 'create') {
              const paidAt = op.data.paidAt ? new Date(op.data.paidAt) : new Date()
              await tx.payment.create({
                data: {
                  saleId: current.id,
                  method: op.data.method as any,
                  amount: toDec(op.data.amount),
                  currency: (op.data.currency ?? 'USD') as any,
                  note: op.data.note ?? null,
                  paidAt,
                },
              })
            }
            if (op.action === 'update') {
              const p = await tx.payment.findUnique({ where: { id: op.id } })
              if (!p || p.saleId !== current.id) throw new Error('Payment not found or mismatched')
              const data: any = {}
              if (op.data.method) data.method = op.data.method
              if (op.data.amount != null) data.amount = toDec(op.data.amount)
              if (op.data.currency) data.currency = op.data.currency
              if ('note' in op.data) data.note = op.data.note ?? null
              if (op.data.paidAt) data.paidAt = new Date(op.data.paidAt)
              await tx.payment.update({ where: { id: p.id }, data })
            }
            if (op.action === 'delete') {
              const p = await tx.payment.findUnique({ where: { id: op.id } })
              if (!p || p.saleId !== current.id) throw new Error('Payment not found or mismatched')
              await tx.payment.delete({ where: { id: p.id } })
            }
          }
        }

        // Releer items y payments para recálculo/validación
        const afterItems = await tx.saleItem.findMany({ where: { saleId: current.id } })
        const afterPayments = await tx.payment.findMany({ where: { saleId: current.id } })

        // Recalcular totales si hubo modificaciones de items
        let totals: any = {}
        if (itemsOps?.length) {
          const mapped = afterItems.map(it => ({
            kind: it.kind,
            units: it.units,
            unitPrice: toDec(it.unitPrice),
            unitCost: toDec(it.unitCost),
            extraCost: toDec(it.extraCost),
          }))
          totals = computeTotals(mapped)
        }

        // Completar saleData con patch manual si viene y no hubo itemsOps
        if (salePatch) {
          if ('customerName' in salePatch) saleData.customerName = salePatch.customerName ?? saleData.customerName ?? null
          if ('origin' in salePatch) saleData.origin = salePatch.origin ?? null
          if ('date' in salePatch && salePatch.date != null) saleData.date = new Date(salePatch.date)
          if (!itemsOps?.length) {
            if ('total' in salePatch && salePatch.total != null) saleData.total = new Decimal(salePatch.total)
            if ('profit' in salePatch && salePatch.profit != null) saleData.profit = new Decimal(salePatch.profit)
            if ('extraCosts' in salePatch && salePatch.extraCosts != null) saleData.extraCosts = new Decimal(salePatch.extraCosts)
          }
        }

        // Merge de totales recalculados
        Object.assign(saleData, totals)

        const updated = Object.keys(saleData).length
          ? await tx.sale.update({
              where: { id: current.id },
              data: saleData,
              include: {
                buyer: { select: { id: true, name: true, surname: true } },
                items: { include: { product: true } },
                payments: true,
              },
            })
          : await tx.sale.findUnique({
              where: { id: current.id },
              include: {
                buyer: { select: { id: true, name: true, surname: true } },
                items: { include: { product: true } },
                payments: true,
              },
            })

        if (enforceBalance) {
          const paid = afterPayments.reduce((acc, p) => acc.plus(toDec(p.amount)), new Decimal(0))
          const total = toDec((updated as any).total)
          if (!paid.equals(total)) {
            throw new Error(`Payments sum ${paid.toString()} != sale.total ${total.toString()}`)
          }
        }

        return updated
      })

      return NextResponse.json({ sale: result }, { status: 200 })
    } catch (err: any) {
      dbg('Advanced PATCH failed:', err?.message || err)
      return NextResponse.json({ error: 'Advanced patch failed', reason: err?.message || String(err) }, { status: 400 })
    }
  }

  // ---------- MODO PLANO ----------
  const flat = FlatPatchSchema.safeParse(raw)
  if (!flat.success) {
    if (DEBUG) dbg('Flat schema error:', flat.error.flatten(), 'raw=', raw)
    return NextResponse.json({ error: 'Invalid request (flat)', details: flat.error.flatten(), raw }, { status: 400 })
  }

  const dataIn = flat.data
  const data: any = {}

  // Strings (aceptan null)
  if ('customerName' in dataIn) data.customerName = dataIn.customerName ?? null
  if ('origin' in dataIn) data.origin = dataIn.origin ?? null

  // Fecha
  if ('date' in dataIn) {
    const d = toISODateLike((dataIn as any).date)
    if (d) data.date = d
    else if (dataIn.date === null) {
      dbg('flat PATCH: date=null ignored')
    } else {
      return NextResponse.json({ error: 'Invalid date format', raw }, { status: 400 })
    }
  }

  // Decimales
  const numOrNull = (v: any) => (v === '' || v == null ? null : Number(v))
  if ('total' in dataIn) {
    const v = numOrNull(dataIn.total)
    if (v == null || !Number.isFinite(v)) return NextResponse.json({ error: 'Invalid total', raw }, { status: 400 })
    data.total = new Decimal(v)
  }
  if ('profit' in dataIn) {
    const v = numOrNull(dataIn.profit)
    if (v == null || !Number.isFinite(v)) return NextResponse.json({ error: 'Invalid profit', raw }, { status: 400 })
    data.profit = new Decimal(v)
  }
  if ('extraCosts' in dataIn) {
    const v = numOrNull(dataIn.extraCosts)
    if (v == null || !Number.isFinite(v)) return NextResponse.json({ error: 'Invalid extraCosts', raw }, { status: 400 })
    data.extraCosts = new Decimal(v)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Si viene buyer, actualizamos/creamos y sincronizamos customerName
      if (dataIn.buyer) {
        const current = await tx.sale.findUnique({
          where: { id: params.id },
          include: { buyer: true },
        })
        if (!current) throw new Error('Sale not found')

        const name = (dataIn.buyer.name ?? '').trim()
        const surname = (dataIn.buyer.surname ?? '').trim()
        const newCustomerName = concatName(name, surname)

        if (current.buyerId) {
          await tx.buyer.update({
            where: { id: current.buyerId },
            data: {
              name: name === '' ? null : name as string | any,
              surname: surname === '' ? null : surname,
            },
          })
        } else {
          const created = await tx.buyer.create({
            data: {
              tenantId: current.tenantId,
              name: name === '' ? null : name as string | any,
              surname: surname === '' ? null : surname,
            },
          })
          // linkear buyer
          data.buyerId = created.id
        }
        // customerName derivado del buyer
        data.customerName = newCustomerName
      }

      const sale = await tx.sale.update({
        where: { id: params.id },
        data,
        include: {
          buyer: { select: { id: true, name: true, surname: true } },
          items: { include: { product: true } },
          payments: true,
        },
      })
      return sale
    })

    return NextResponse.json({ sale: result }, { status: 200 })
  } catch (err: any) {
    dbg('flat PATCH failed:', err?.message || err)
    return NextResponse.json({ error: 'Could not update sale', reason: err?.message || String(err) }, { status: 500 })
  }
}

/* ===========================
   DELETE (restaura stock y borra)
=========================== */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.$transaction(async (tx) => {
      const items = await tx.saleItem.findMany({
        where: { saleId: params.id },
        select: { productId: true, units: true },
      })
      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.units } },
        })
      }
      await tx.sale.delete({ where: { id: params.id } })
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    dbg('DELETE failed:', (err as any)?.message || err)
    return NextResponse.json({ error: 'Error eliminando venta', reason: (err as any)?.message || String(err) }, { status: 500 })
  }
}
