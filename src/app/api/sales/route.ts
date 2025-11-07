
import { prisma } from '@/lib/prisma';
import { SaleItemKind } from '@prisma/client';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

// GET: lista de ventas con items
export async function GET() {
  const sales = await prisma.sale.findMany({
    include: { items: { include: { product: true } }, payments: true, buyer: true },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(sales);
}

// POST: crea una venta y sus items, actualiza stock
export async function POST(request: Request) {
  const body = await request.json();
  const { date, buyerId, customerName, origin, notes, items, payments } = body;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Sale must have at least one item' }, { status: 400 });
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json({ error: 'Sale must have at least one payment' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get tenant and all products in one go for validation
      const tenant = await tx.tenant.findFirst({ where: { id: process.env.DEFAULT_TENANT_ID as string } });
      if (!tenant) throw new Error('No tenant found');

      const productIds = items.map((item: any) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      // 2. Server-side calculation of totals using Prisma.Decimal
      let subtotal = new Prisma.Decimal(0);
      let costTotal = new Prisma.Decimal(0);
      let extraCosts = new Prisma.Decimal(0);

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product with id ${item.productId} not found`); // This should ideally not happen
        }

        // Stock validation
        if (product.stock < item.units) {
          const error: any = new Error(`Insufficient stock for ${product.modelName}. Available: ${product.stock}, Requested: ${item.units}`);
          error.statusCode = 409; // Conflict
          throw error;
        }

        const itemUnitPrice = new Prisma.Decimal(item.unitPrice);
        const itemUnitCost = new Prisma.Decimal(item.unitCost);
        const itemExtraCost = new Prisma.Decimal(item.extraCost || 0);
        const units = new Prisma.Decimal(item.units);

        const lineCost = units.mul(itemUnitCost.add(itemExtraCost));
        costTotal = costTotal.add(lineCost);

        if (item.kind === 'NORMAL') {
          subtotal = subtotal.add(units.mul(itemUnitPrice));
        } else if (item.kind === 'IN_TOTAL') {
          // The cost of IN_TOTAL items is added to extraCosts
          extraCosts = extraCosts.add(lineCost);
        }
        // For ZERO_COST, nothing is added to subtotal or extraCosts
      }

      const total = subtotal.add(extraCosts);
      const profit = total.sub(costTotal);

      // 3. Validate payments total against calculated total
      const totalPaid = payments.reduce(
        (acc: Prisma.Decimal, p: any) => acc.add(new Prisma.Decimal(p.amount)),
        new Prisma.Decimal(0)
      );

      if (!totalPaid.equals(total)) {
        const error: any = new Error(`Payment total (${totalPaid}) does not match sale total (${total})`);
        error.statusCode = 400; // Bad Request
        throw error;
      }

      // 4. Create Sale, SaleItems, and Payments
      const sale = await tx.sale.create({
        data: {
          tenantId: tenant.id,
          date: date ? new Date(date) : new Date(),
          buyerId: buyerId || null,
          customerName: buyerId ? undefined : customerName || 'Consumidor Final',
          origin: origin || null,
          notes: notes || null,
          subtotal,
          extraCosts,
          costTotal,
          total,
          profit,
          payments: {
            create: payments.map((p: any) => ({
              method: p.method,
              currency: p.currency,
              amount: new Prisma.Decimal(p.amount),
              note: p.note,
              paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
            })),
          },
        },
      });

      // 5. Create SaleItems and update stock
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const itemUnitPrice = new Prisma.Decimal(item.unitPrice);
        const itemUnitCost = new Prisma.Decimal(product.costPrice); // authoritative cost from DB
        const itemExtraCost = new Prisma.Decimal(item.extraCost || 0);
        const units = item.units;

        let lineTotal = new Prisma.Decimal(0);
        if (item.kind === 'NORMAL') {
          lineTotal = itemUnitPrice.mul(units);
        }

        const lineCost = itemUnitCost.add(itemExtraCost).mul(units);
        const lineProfit = lineTotal.sub(lineCost);

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            kind: item.kind as SaleItemKind,
            units,
            unitPrice: itemUnitPrice,
            unitCost: itemUnitCost,
            extraCost: itemExtraCost,
            lineTotal,
            lineCost,
            lineProfit,
            // Link accessories to phones if needed (future)
            // parentItemId: item.parentItemId,
            // selectedExtras: item.selectedExtras,
            // extraCostBreakdown: item.extraCostBreakdown,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: units } },
        });
      }

      return tx.sale.findUnique({ where: { id: sale.id }, include: { items: true, payments: true } });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error(err);
    if (err.statusCode) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Error creating sale' }, { status: 500 });
  }
}