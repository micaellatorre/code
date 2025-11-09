// app/api/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ProductSate } from "@prisma/client";

type Params = { params: { id: string } };

// Normaliza número entero >= 0
function parseIntNonNeg(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// Normaliza decimal (string/number) a Prisma.Decimal o null
function parseDecimalOrNull(v: any): Prisma.Decimal | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(s);
}

export async function PATCH(req: Request, { params }: Params) {
  const id = params.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Leer snapshot actual para calcular derivadas
      const current = await tx.product.findUnique({
        where: { id },
        select: {
          id: true,
          modelName: true,
          imei: true,
          batteryPct: true,
          color: true,
          brand: true,
          capacityGB: true,
          condition: true,
          costPrice: true,
          salePrice: true,
          shippingCost: true,
          state: true,
          status: true,
          stockInitial: true,
          stock: true,
          stockAvailable: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!current) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      // 2) Construir data de actualización campo a campo
      const data: any = {};

      // Campos string/nullable
      if ("modelName" in payload) data.modelName = payload.modelName ?? current.modelName;
      if ("imei" in payload) data.imei = payload.imei ?? null;
      if ("color" in payload) data.color = payload.color ?? null;
      if ("brand" in payload) data.brand = payload.brand ?? null;
      if ("notes" in payload) data.notes = payload.notes ?? null;

      // Fechas
      if ("createdAt" in payload) {
        data.createdAt = payload.createdAt ? new Date(payload.createdAt) : current.createdAt;
      }

      // Ints
      if ("batteryPct" in payload) {
        const n = payload.batteryPct === null ? null : parseIntNonNeg(payload.batteryPct);
        if (n === null && payload.batteryPct !== null) {
          return NextResponse.json({ error: "batteryPct inválido" }, { status: 400 });
        }
        data.batteryPct = n;
      }
      if ("capacityGB" in payload) {
        const n = payload.capacityGB === null ? null : parseIntNonNeg(payload.capacityGB);
        if (n === null && payload.capacityGB !== null) {
          return NextResponse.json({ error: "capacityGB inválido" }, { status: 400 });
        }
        data.capacityGB = n;
      }
      if ("stockInitial" in payload) {
        const n = parseIntNonNeg(payload.stockInitial);
        if (n === null) return NextResponse.json({ error: "stockInitial inválido" }, { status: 400 });
        data.stockInitial = n;
      }

      // Enums
      if ("condition" in payload) data.condition = payload.condition ?? null;
      if ("status" in payload) data.status = payload.status;

      // Decimales
      if ("costPrice" in payload) {
        const d = parseDecimalOrNull(payload.costPrice);
        if (d === null && payload.costPrice !== null) {
          return NextResponse.json({ error: "costPrice inválido" }, { status: 400 });
        }
        if (d !== null) data.costPrice = d;
        else if (payload.costPrice === null) data.costPrice = new Prisma.Decimal(0);
      }
      if ("salePrice" in payload) {
        const d = parseDecimalOrNull(payload.salePrice);
        if (d === null && payload.salePrice !== null) {
          return NextResponse.json({ error: "salePrice inválido" }, { status: 400 });
        }
        if (d !== null) data.salePrice = d;
        else if (payload.salePrice === null) data.salePrice = new Prisma.Decimal(0);
      }
      if ("shippingCost" in payload) {
        if (payload.shippingCost === null) {
          data.shippingCost = null;
        } else {
          const d = parseDecimalOrNull(payload.shippingCost);
          if (d === null) return NextResponse.json({ error: "shippingCost inválido" }, { status: 400 });
          data.shippingCost = d;
        }
      }

      // Stock + stockAvailable
      let willUpdateStock = false;
      let nextStock = current.stock;

      if ("stock" in payload) {
        const n = parseIntNonNeg(payload.stock);
        if (n === null) return NextResponse.json({ error: "stock inválido" }, { status: 400 });
        data.stock = n;
        nextStock = n;
        willUpdateStock = true;
      }

      if ("stockAvailable" in payload) {
        const n = parseIntNonNeg(payload.stockAvailable);
        if (n === null) return NextResponse.json({ error: "stockAvailable inválido" }, { status: 400 });
        data.stockAvailable = n;
      } else if (willUpdateStock) {
        // Si no nos mandan stockAvailable explícito, ajustamos por delta de stock
        const delta = nextStock - current.stock;
        data.stockAvailable = Math.max(0, (current.stockAvailable ?? 0) + delta);
      }

      // Estado (puede venir explícito o ajustarse en base a stock)
      let explicitState: ProductSate | null = null;
      if ("state" in payload && payload.state) {
        explicitState = payload.state as ProductSate;
        data.state = explicitState;
      }

      // 3) Aplicar update principal
      const updated = await tx.product.update({
        where: { id: current.id },
        data,
        select: {
          id: true,
          modelName: true,
          imei: true,
          batteryPct: true,
          color: true,
          brand: true,
          capacityGB: true,
          condition: true,
          costPrice: true,
          salePrice: true,
          shippingCost: true,
          state: true,
          status: true,
          stockInitial: true,
          stock: true,
          stockAvailable: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 4) Auto–ajuste de state si no vino explícito
      //    - stock < 1  -> FUERA_DE_STOCK
      //    - stock >= 1 -> EN_STOCK (si estaba fuera de stock)
      if (!explicitState) {
        let nextState: ProductSate | null = null;
        if (updated.stock < 1 && updated.state !== "FUERA_DE_STOCK") {
          nextState = "FUERA_DE_STOCK";
        } else if (updated.stock >= 1 && updated.state === "FUERA_DE_STOCK") {
          nextState = "EN_STOCK";
        }

        if (nextState) {
          const final = await tx.product.update({
            where: { id: updated.id },
            data: { state: nextState },
            select: {
              id: true,
              modelName: true,
              imei: true,
              batteryPct: true,
              color: true,
              brand: true,
              capacityGB: true,
              condition: true,
              costPrice: true,
              salePrice: true,
              shippingCost: true,
              state: true,
              status: true,
              stockInitial: true,
              stock: true,
              stockAvailable: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          return NextResponse.json(final);
        }
      }

      return NextResponse.json(updated);
    });

    return result; // NextResponse ya armado adentro
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error actualizando producto" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const id = params.id;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error eliminando producto" }, { status: 500 });
  }
}
