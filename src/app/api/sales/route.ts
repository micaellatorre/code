// app/api/sales/route.ts
import prisma from "@/lib/prisma";
import { requireRoleApi } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import { Prisma, ProductState, SaleItemKind, SaleStatus, UserRole } from "@prisma/client";
import { resolveSessionTenantId } from "@/lib/tenant";
import { resolveOperationBranch } from "@/lib/domain/user-branches";
import { isMonetaryPaymentMethod, postSalePaymentToCash } from "@/lib/domain/cash";
import { normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money";
import { normalizeCatalogValue } from "@/lib/config/normalizeCatalogValue";

type SaleOperationType = "CONFIRM_SALE" | "RESERVE";

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"]);

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status });
  }
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 });
  }
  const canSeeFinancials = auth.session.user.activeRole === "ADMIN" || auth.session.user.activeRole === "SOCIO";

  const sales = await prisma.sale.findMany({
    where: { tenantId },
    include: {
      items: { include: { product: true } },
      payments: true,
      buyer: true,
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(sales.map((sale) => ({
    ...sale,
    costTotal: canSeeFinancials ? sale.costTotal : null,
    profit: canSeeFinancials ? sale.profit : null,
    items: sale.items.map((item) => ({
      ...item,
      unitCost: canSeeFinancials ? item.unitCost : null,
      lineCost: canSeeFinancials ? item.lineCost : null,
      lineProfit: canSeeFinancials ? item.lineProfit : null,
      product: {
        ...item.product,
        costPrice: canSeeFinancials ? item.product.costPrice : null,
        shippingCost: canSeeFinancials ? item.product.shippingCost : null,
      },
    })),
  })));
}

interface SaleItemInput {
  clientLineId?: string | null;
  parentClientLineId?: string | null;
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
  exchangeRate?: number | string | null;
  cashAccountId?: string | null;
  note?: string;
  paidAt?: string;
}

interface SaleInputBody {
  operationType?: SaleOperationType;
  appointmentId?: string | null;
  operationFlow?: string;
  tradeInDevices?: {
    modelName?: string;
    capacityGB?: number;
    color?: string;
    imei?: string;
    finalValue?: number;
    notes?: string;
    batteryRangeLabel?: string;
  }[];
  date?: string;
  buyerId?: string;
  branchId?: string | null;
  closerId?: string | null;
  saleType?: "MINORISTA" | "MAYORISTA" | null;
  customerName?: string;
  origin?: string;
  notes?: string;
  items: SaleItemInput[];
  payments: PaymentInput[];
}

interface ApiError extends Error {
  statusCode?: number;
}

function apiError(message: string, statusCode = 400): ApiError {
  const err = new Error(message) as ApiError;
  err.statusCode = statusCode;
  return err;
}

function decimal(value: number | string | Prisma.Decimal | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function isAllowedToConfirmSale(state: ProductState) {
  return state === "EN_STOCK" || state === "DISPONIBLE";
}

function isAllowedToReserve(state: ProductState) {
  return state === "EN_STOCK" || state === "EN_CAMINO";
}

async function resolveProductCatalogModelId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  product: { catalogModelId?: string | null; type: string; modelName: string },
) {
  if (product.catalogModelId) return product.catalogModelId;
  const catalog = await tx.productCatalogModel.findFirst({
    where: {
      tenantId,
      type: product.type as any,
      normalizedName: normalizeCatalogValue(product.modelName),
    },
    select: { id: true },
  });
  return catalog?.id ?? null;
}

async function assertParentLinks(params: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  items: (SaleItemInput & { clientLineId: string })[];
  productMap: Map<string, any>;
}) {
  const itemByClientLineId = new Map(params.items.map((item) => [item.clientLineId, item]));

  for (const item of params.items) {
    if (!item.parentClientLineId) continue;
    if (item.parentClientLineId === item.clientLineId) {
      throw apiError("No se permite una asociacion circular.", 400);
    }

    const parent = itemByClientLineId.get(item.parentClientLineId);
    if (!parent) throw apiError("El accesorio asociado no tiene un equipo padre valido.", 400);

    const parentProduct = params.productMap.get(String(parent.productId));
    const childProduct = params.productMap.get(String(item.productId));
    if (!parentProduct || !childProduct) throw apiError("Producto asociado no disponible.", 400);
    if (parentProduct.type !== "PHONE") throw apiError("El item padre debe ser un equipo PHONE.", 400);
    if (childProduct.type !== "ACCESSORY") throw apiError("El item asociado debe ser un accesorio.", 400);

    const phoneCatalogModelId = await resolveProductCatalogModelId(params.tx, params.tenantId, parentProduct);
    const accessoryCatalogModelId = await resolveProductCatalogModelId(params.tx, params.tenantId, childProduct);
    if (!phoneCatalogModelId || !accessoryCatalogModelId) {
      throw apiError("Los items asociados deben tener modelo de catalogo compatible.", 400);
    }

    const compatibility = await params.tx.productModelCompatibility.findFirst({
      where: {
        tenantId: params.tenantId,
        phoneModelId: phoneCatalogModelId,
        accessoryModelId: accessoryCatalogModelId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!compatibility) throw apiError("El accesorio no es compatible con el equipo seleccionado.", 400);
  }
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"]);

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status });
  }

  let body: SaleInputBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    operationType = "CONFIRM_SALE",
    appointmentId,
    date,
    buyerId,
    branchId,
    closerId,
    saleType,
    customerName,
    origin,
    notes,
    items,
    payments,
    tradeInDevices,
  } = body;

  if (!["CONFIRM_SALE", "RESERVE"].includes(operationType)) {
    return NextResponse.json({ error: "Tipo de operación inválido." }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "La operación debe tener al menos 1 item." },
      { status: 400 },
    );
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json(
      { error: "La operación debe incluir al menos un pago." },
      { status: 400 },
    );
  }

  let newSaleId: string | null = null;

  try {
    const txResult = await prisma.$transaction(
      async (tx) => {
        const tenantId = await resolveSessionTenantId(auth.session.user.tenantId);
        if (!tenantId) throw apiError("DEFAULT_TENANT_ID no configurado", 500);

        const tenant = await tx.tenant.findFirst({ where: { id: tenantId } });
        if (!tenant) throw apiError("Tenant no encontrado", 500);
        const operationBranch = await resolveOperationBranch({
          actorUserId: auth.session.user.id,
          actorRole: auth.session.user.activeRole,
          tenantId: tenant.id,
          requestedBranchId: branchId,
          entityLabel: "venta",
        }, tx);
        if (closerId) {
          const closer = await tx.user.findFirst({ where: { id: closerId, tenantId: tenant.id, role: "VENDEDOR", isActive: true }, select: { id: true } });
          if (!closer) throw apiError("Closer no disponible. Debe ser un usuario vendedor activo.", 400);
        }

        const productIds = items.map((it) => String(it.productId));
        const normalizedItems = items.map((item, index) => ({
          ...item,
          clientLineId: item.clientLineId || `server-line-${index}`,
          parentClientLineId: item.parentClientLineId || null,
        }));
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, tenantId: tenant.id },
          select: {
            id: true,
            modelName: true,
            type: true,
            catalogModelId: true,
            imei: true,
            stock: true,
            stockAvailable: true,
            costPrice: true,
            state: true,
            senado: true,
          },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        await assertParentLinks({ tx, tenantId: tenant.id, items: normalizedItems, productMap });

        let subtotal = new Prisma.Decimal(0);
        let costTotal = new Prisma.Decimal(0);
        let extraCosts = new Prisma.Decimal(0);

        for (const raw of normalizedItems) {
          const prod = productMap.get(String(raw.productId));
          if (!prod) {
            throw apiError(`No se encontró el producto ${raw.productId}`, 400);
          }

          if (prod.senado && !appointmentId) {
            throw apiError("El producto ya está señado.", 409);
          }

          if (operationType === "CONFIRM_SALE" && !isAllowedToConfirmSale(prod.state)) {
            throw apiError("Solo se pueden vender productos en stock.", 409);
          }

          if (operationType === "RESERVE" && !isAllowedToReserve(prod.state)) {
            throw apiError("Solo se pueden señar productos en stock o en camino.", 409);
          }

          const unitsNum = Number(raw.units);
          if (!Number.isInteger(unitsNum) || unitsNum < 1) {
            throw apiError(`Cantidad inválida para ${prod.modelName}.`, 400);
          }

          if (prod.stockAvailable < unitsNum) {
            throw apiError(
              `Stock insuficiente para ${prod.modelName}. Disponible: ${prod.stockAvailable}, solicitado: ${unitsNum}`,
              409,
            );
          }

          const units = new Prisma.Decimal(unitsNum);
          const unitPrice = decimal(raw.unitPrice);
          const unitCost = decimal(prod.costPrice);
          const extra = decimal(raw.extraCost);
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
        const totalPaid = payments.reduce(
          (acc, p) => acc.add(decimal(p.amount)),
          new Prisma.Decimal(0),
        );

        if (operationType === "CONFIRM_SALE" && !totalPaid.equals(total)) {
          throw apiError(
            `El total de pagos (${totalPaid.toFixed(2)}) no coincide con el total de la venta (${total.toFixed(2)}).`,
            400,
          );
        }

        if (operationType === "RESERVE") {
          if (totalPaid.lessThanOrEqualTo(0)) {
            throw apiError("La seña debe tener al menos un pago mayor a 0.", 400);
          }

          if (totalPaid.greaterThan(total)) {
            throw apiError("La seña no puede superar el total de la venta.", 400);
          }
        }

        const saleStatus: SaleStatus = operationType === "RESERVE" ? "SENADA" : "CONFIRMADA";
        const balanceDue = total.sub(totalPaid);
        const paymentsData = payments.map((p) => ({
          method: p.method as any,
          currency: p.currency as any,
          amount: decimal(p.amount),
          exchangeRate: optionalDecimal(p.exchangeRate),
          amountUsd: normalizeAmountUsd(decimal(p.amount), String(p.currency), optionalDecimal(p.exchangeRate)),
          cashAccountId: isMonetaryPaymentMethod(p.method) ? p.cashAccountId || null : null,
          note: p.note,
          paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
        }));

        const sale = await tx.sale.create({
          data: {
            tenantId: tenant.id,
            userId: auth.session.user.id,
            branchId: operationBranch.id,
            closerId: closerId || null,
            saleType: saleType || null,
            date: date ? new Date(date) : new Date(),
            buyerId: buyerId || null,
            customerName: buyerId ? undefined : customerName || "Consumidor Final",
            origin: origin || null,
            notes: notes || null,
            status: saleStatus,
            amountPaid: totalPaid,
            balanceDue,
            subtotal,
            extraCosts,
            costTotal,
            total,
            profit,
            payments: { create: paymentsData },
          },
          select: { id: true },
        });

        const createdPayments = await tx.payment.findMany({ where: { saleId: sale.id } });
        for (const payment of createdPayments) {
          await postSalePaymentToCash({
            tx,
            tenantId: tenant.id,
            actorUserId: auth.session.user.id,
            actorRole: auth.session.user.activeRole as UserRole,
            sale: { id: sale.id, branchId: operationBranch.id, customerName },
            payment,
          });
        }

        if (appointmentId && operationType === "CONFIRM_SALE") {
          await tx.appointment.update({
            where: { id: appointmentId },
            data: {
              saleId: sale.id,
              outcome: "VENTA_CONCRETADA",
              status: "CONCRETADA",
            },
          });
        }

        if (Array.isArray(tradeInDevices) && tradeInDevices.length > 0) {
          for (const device of tradeInDevices) {
            const finalValue = decimal(device.finalValue ?? 0);
            if (!device.modelName || finalValue.lessThanOrEqualTo(0)) continue;

            await tx.product.create({
              data: {
                tenantId: tenant.id,
                type: "PHONE",
                modelName: device.modelName,
                capacityGB: device.capacityGB ? Number(device.capacityGB) : null,
                color: device.color || null,
                imei: device.imei || null,
                costPrice: finalValue,
                salePrice: new Prisma.Decimal(0),
                state: "EN_REVISION",
                stockInitial: 1,
                stock: 1,
                stockAvailable: 0,
                origin: "Plan Canje",
                branchId: operationBranch.id,
                notes: [
                  device.batteryRangeLabel ? `Bateria: ${device.batteryRangeLabel}` : null,
                  device.notes || null,
                  `Venta origen: ${sale.id}`,
                ].filter(Boolean).join("\n"),
              },
            });
          }
        }

        const createdSaleItemIds = new Map<string, string>();
        const creationOrder = [
          ...normalizedItems.filter((item) => !item.parentClientLineId),
          ...normalizedItems.filter((item) => item.parentClientLineId),
        ];

        for (const raw of creationOrder) {
          const prod = productMap.get(String(raw.productId))!;
          const unitsNum = Number(raw.units);
          const unitsDec = new Prisma.Decimal(unitsNum);
          const unitPrice = decimal(raw.unitPrice);
          const unitCost = decimal(prod.costPrice);
          const extra = decimal(raw.extraCost);

          let lineTotal = new Prisma.Decimal(0);
          if (raw.kind === "NORMAL") {
            lineTotal = unitPrice.mul(unitsDec);
          }

          const lineCost = unitCost.add(extra).mul(unitsDec);
          const lineProfit = lineTotal.sub(lineCost);

          const createdItem = await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: prod.id,
              parentItemId: raw.parentClientLineId ? createdSaleItemIds.get(raw.parentClientLineId) ?? null : null,
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
          createdSaleItemIds.set(raw.clientLineId, createdItem.id);

          if (operationType === "RESERVE") {
            await tx.product.update({
              where: { id: prod.id },
              data: {
                senado: true,
                senadoAt: new Date(),
              },
            });

            continue;
          }

          const updated = await tx.product.update({
            where: { id: prod.id },
            data: {
              stock: { decrement: unitsNum },
              stockAvailable: { decrement: unitsNum },
            },
            select: { id: true, modelName: true, stock: true, stockAvailable: true, state: true },
          });

          let nextState: ProductState | null = null;
          if (updated.stock < 1) {
            nextState = prod.type === "PHONE" ? "VENDIDO" : "FUERA_DE_STOCK";
          } else if (updated.stock >= 1 && updated.state === "FUERA_DE_STOCK") {
            nextState = "EN_STOCK";
          }

          if (nextState) {
            await tx.product.update({
              where: { id: prod.id },
              data: { state: nextState },
            });
          }

          prod.stock = updated.stock;
          prod.stockAvailable = updated.stockAvailable;
          prod.state = nextState ?? updated.state;
        }

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: auth.session.user.id,
            actorRole: auth.session.user.activeRole as UserRole,
            action: operationType === "RESERVE" ? "RESERVATION_CREATED" : "SALE_CONFIRMED",
            module: operationType === "RESERVE" ? "RESERVATION" : "SALE",
            entityType: "Sale",
            entityId: sale.id,
            detail: operationType === "RESERVE" ? "Reserva creada desde ventas" : "Venta confirmada",
            metadata: {
              total: total.toString(),
              amountPaid: totalPaid.toString(),
              balanceDue: balanceDue.toString(),
              items: normalizedItems.length,
            },
          },
        });

        return { saleId: sale.id };
      },
      { timeout: 15000, maxWait: 5000 },
    );

    newSaleId = txResult.saleId;

    const created = await prisma.sale.findUnique({
      where: { id: newSaleId },
      include: {
        buyer: true,
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, code: true, name: true } },
        payments: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const error = err as ApiError;
    console.error("Error creating sale/reservation", error);

    if (error.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error.message?.includes("Sucursal") || error.message?.includes("Selecciona") || error.message?.includes("permisos")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: "Error creating sale" }, { status: 500 });
  }
}
