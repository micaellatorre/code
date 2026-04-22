// app/api/sales/route.ts
import prisma from "@/lib/prisma";
import { requireRoleApi } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import { Prisma, SaleItemKind, ProductState } from "@prisma/client";

// GET: lista de ventas con items, payments y buyer
export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const sales = await prisma.sale.findMany({
    include: {
      items: { include: { product: true } },
      payments: true,
      buyer: true,
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(sales);
}

interface SaleItemInput {
  productId: string;
  kind: SaleItemKind;
  units: number;
  unitPrice: number | string;
  extraCost?: number | string;
}

interface PaymentInput {
  method: string;
  currency: string;
  amount: number | string;
  note?: string;
  paidAt?: string;
}

interface SaleInputBody {
  date?: string;
  buyerId?: string;
  customerName?: string;
  origin?: string;
  notes?: string;
  items: SaleItemInput[];
  payments: PaymentInput[];
}

interface ApiError extends Error {
  statusCode?: number;
}

// POST: crea una venta y sus items/pagos; descuenta stock y controla estado
export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  let body: SaleInputBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { date, buyerId, customerName, origin, notes, items, payments } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "La venta debe tener al menos 1 item." },
      { status: 400 }
    );
  }
  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json(
      { error: "La venta debe incluir el total de pagos declarados." },
      { status: 400 }
    );
  }

  let newSaleId: string | null = null;

  try {
    const txResult = await prisma.$transaction(
      async (tx) => {
        const tenantId = process.env.DEFAULT_TENANT_ID as string | undefined;
        if (!tenantId) {
          const err = new Error("DEFAULT_TENANT_ID no configurado") as ApiError;
          err.statusCode = 500;
          throw err;
        }
        const tenant = await tx.tenant.findFirst({ where: { id: tenantId } });
        if (!tenant) {
          const err = new Error("Tenant no encontrado") as ApiError;
          err.statusCode = 500;
          throw err;
        }

        // Productos necesarios para validar y calcular
        const productIds = items.map((it) => String(it.productId));
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            modelName: true,
            stock: true,
            stockAvailable: true,
            costPrice: true,
            state: true,
          },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        // Cálculo de totales con Decimal (autoridad servidor)
        let subtotal = new Prisma.Decimal(0);
        let costTotal = new Prisma.Decimal(0);
        let extraCosts = new Prisma.Decimal(0);

        for (const raw of items) {
          const prod = productMap.get(String(raw.productId));
          if (!prod) {
            const err = new Error(
              `No se encontró el producto ${raw.productId}`
            ) as ApiError;
            err.statusCode = 400;
            throw err;
          }

          // Stock
          if (prod.stock < raw.units) {
            const err = new Error(
              `Stock insuficiente para ${prod.modelName}. Disponible: ${prod.stock}, solicitado: ${raw.units}`
            ) as ApiError;
            err.statusCode = 409;
            throw err;
          }

          const units = new Prisma.Decimal(raw.units);
          const unitPrice = new Prisma.Decimal(raw.unitPrice);
          const unitCost = new Prisma.Decimal(prod.costPrice); // costo autoridad DB
          const extra = new Prisma.Decimal(raw.extraCost || 0);

          const lineCost = units.mul(unitCost.add(extra));
          costTotal = costTotal.add(lineCost);

          if (raw.kind === "NORMAL") {
            subtotal = subtotal.add(units.mul(unitPrice));
          } else if (raw.kind === "IN_TOTAL") {
            extraCosts = extraCosts.add(lineCost);
          }
        }

        const total = subtotal.add(extraCosts);
        const profit = total.sub(costTotal);

        // Validación de pagos
        const totalPaid = payments.reduce(
          (acc, p) => acc.add(new Prisma.Decimal(p.amount)),
          new Prisma.Decimal(0)
        );
        if (!totalPaid.equals(total)) {
          const err = new Error(
            `El total de pagos (${totalPaid}) no coincide con el total de la venta (${total})`
          ) as ApiError;
          err.statusCode = 400;
          throw err;
        }

        // Crear Sale + Payments
        const paymentsData = payments.map((p) => ({
          method: p.method as any, // Cast necessary if method is string but Enum type required
          currency: p.currency as any,
          amount: new Prisma.Decimal(p.amount),
          note: p.note,
          paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
        }));

        const sale = await tx.sale.create({
          data: {
            tenantId: tenant.id,
            date: date ? new Date(date) : new Date(),
            buyerId: buyerId || null,
            customerName: buyerId ? undefined : customerName || "Consumidor Final",
            origin: origin || null,
            notes: notes || null,
            subtotal,
            extraCosts,
            costTotal,
            total,
            profit,
            payments: {
              create: paymentsData,
            },
          },
          select: { id: true },
        });

        // SaleItems + actualización de productos
        for (const raw of items) {
          const prod = productMap.get(String(raw.productId))!;
          const unitsNum = Number(raw.units);
          const unitsDec = new Prisma.Decimal(unitsNum);

          const unitPrice = new Prisma.Decimal(raw.unitPrice);
          const unitCost = new Prisma.Decimal(prod.costPrice);
          const extra = new Prisma.Decimal(raw.extraCost || 0);

          let lineTotal = new Prisma.Decimal(0);
          if (raw.kind === "NORMAL") {
            lineTotal = unitPrice.mul(unitsDec);
          }
          const lineCost = unitCost.add(extra).mul(unitsDec);
          const lineProfit = lineTotal.sub(lineCost);

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: prod.id,
              kind: raw.kind,
              units: unitsNum,
              unitPrice,
              unitCost,
              extraCost: extra,
              lineTotal,
              lineCost,
              lineProfit,
            },
          });

          // Descontar stock y leer stock resultante
          const updated = await tx.product.update({
            where: { id: prod.id },
            data: {
              stock: { decrement: unitsNum },
              stockAvailable: { decrement: unitsNum },
            },
            select: { id: true, modelName: true, stock: true, state: true },
          });

          // Cambiar estado según stock resultante
          let nextState: ProductState | null = null;
          if (updated.stock < 1 && updated.state !== "FUERA_DE_STOCK") {
            nextState = "FUERA_DE_STOCK";
          } else if (updated.stock >= 1 && updated.state === "FUERA_DE_STOCK") {
            nextState = "EN_STOCK";
          }

          if (nextState) {
            await tx.product.update({
              where: { id: prod.id },
              data: { state: nextState },
            });
          }

          // Sync snapshot local para consistencia si hubiera más iteraciones
          prod.stock = updated.stock;
          prod.state = nextState ?? updated.state;
        }

        return { saleId: sale.id };
      },
      { timeout: 15000, maxWait: 5000 }
    );

    newSaleId = txResult.saleId;

    // Lectura FUERA de la transacción
    const created = await prisma.sale.findUnique({
      where: { id: newSaleId },
      include: {
        buyer: true,
        payments: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const error = err as ApiError;
    if (error.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Error creating sale" }, { status: 500 });
  }
}
