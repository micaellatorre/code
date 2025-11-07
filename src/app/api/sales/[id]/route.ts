import { NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Campos numéricos que deben mapearse a Decimal
const DECIMAL_FIELDS = new Set([
  "subtotal",
  "extraCosts",
  "total",
  "profit",
  "costTotal",
]);

// Solo permitimos actualizar estos campos directos (patch de campo individual)
const ALLOWED_FIELDS = new Set<string>([
  "date",
  "customerName",
  "origin",
  "payment",
  "notes",
  "subtotal",
  "extraCosts",
  "total",
  "profit",
  "costTotal",
  "buyer",
]);

function toDecimal(v: any): Prisma.Decimal | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { buyer: true, items: { include: { product: true } } },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sale });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    await prisma.$transaction(async (tx) => {
      // Si tienes items relacionados, borra primero (ajusta nombres si difieren)
      await tx.saleItem.deleteMany({ where: { saleId: id } }).catch(() => {});
      await tx.sale.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "DELETE failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json().catch(() => ({} as any));

  // Validar campos permitidos
  const keys = Object.keys(body || {});
  if (keys.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (!keys.every((k) => ALLOWED_FIELDS.has(k))) {
    return NextResponse.json({ error: "Some fields are not allowed" }, { status: 400 });
  }

  // Caso especial: buyer: { name?, surname? }
  if (body.buyer && typeof body.buyer === "object") {
    const name = (body.buyer.name ?? "").trim();
    const surname = (body.buyer.surname ?? "").trim();

    try {
      const updated = await prisma.sale.update({
        where: { id },
        data: {
          // Mantener customerName sincronizado con buyer
          customerName: [name, surname].filter(Boolean).join(" ") || null,
          // Para una relación 1-1 opcional llamada "buyer"
          buyer: {
            upsert: {
              update: { name, surname: surname || null },
              create: { tenantId: process.env.DEFAULT_TENANT_ID as string, name: name as string, surname: surname as string || null },
            },
          },
        },
        include: { buyer: true, items: { include: { product: true } } },
      });

      return NextResponse.json({ sale: updated });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "PATCH failed" }, { status: 500 });
    }
  }

  // Actualización de campo individual (numérico/fecha/string)
  const data: any = {};
  for (const k of keys) {
    const v = body[k];

    if (DECIMAL_FIELDS.has(k)) {
      data[k] = toDecimal(v);
      continue;
    }

    if (k === "date") {
      data[k] = v == null ? null : new Date(v);
      continue;
    }

    // strings/nullable
    data[k] = v ?? null;
  }

  try {
    const updated = await prisma.sale.update({
      where: { id },
      data,
      include: { buyer: true, items: { include: { product: true } } },
    });
    return NextResponse.json({ sale: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "PATCH failed" }, { status: 500 });
  }
}
