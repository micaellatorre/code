import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"

export const runtime = "nodejs"

const DECIMAL_FIELDS = new Set(["subtotal", "extraCosts", "total", "profit", "costTotal"])
const ALLOWED_FIELDS = new Set<string>([
  "date",
  "customerName",
  "origin",
  "notes",
  "subtotal",
  "extraCosts",
  "total",
  "profit",
  "costTotal",
  "buyer",
  "userId",
])

type Ctx = { params: Promise<{ id: string }> }

function toDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return null
  return new Prisma.Decimal(n)
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { buyer: true, user: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } },
  })
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ sale })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  try {
    await prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({ where: { saleId: id } }).catch(() => {})
      await tx.sale.delete({ where: { id } })
    })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error?.message ?? "DELETE failed" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const keys = Object.keys(body || {})
  if (keys.length === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 })
  if (!keys.every((k) => ALLOWED_FIELDS.has(k))) {
    return NextResponse.json({ error: "Some fields are not allowed" }, { status: 400 })
  }

  const buyerObj = body.buyer as Record<string, string> | undefined
  if (buyerObj && typeof buyerObj === "object") {
    const name = (buyerObj.name ?? "").trim()
    const surname = (buyerObj.surname ?? "").trim()

    try {
      const updated = await prisma.sale.update({
        where: { id },
        data: {
          customerName: [name, surname].filter(Boolean).join(" ") || null,
          buyer: {
            upsert: {
              update: { name, surname: surname || null },
              create: {
                tenantId: process.env.DEFAULT_TENANT_ID as string,
                name: name as string,
                surname: (surname as string) || null,
              },
            },
          },
        },
        include: { buyer: true, user: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } },
      })
      return NextResponse.json({ sale: updated })
    } catch (e: unknown) {
      const error = e as Error
      return NextResponse.json({ error: error?.message ?? "PATCH failed" }, { status: 500 })
    }
  }

  const data: Record<string, unknown> = {}
  for (const k of keys) {
    const v = body[k]
    if (k === "userId") {
      if (v == null || String(v).trim() === "") {
        data[k] = null
        continue
      }

      const tenantId = auth.session.user.tenantId
      if (!tenantId) {
        return NextResponse.json({ error: "Tenant no disponible para el usuario autenticado" }, { status: 403 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: String(v).trim() },
        select: { id: true, tenantId: true },
      })

      if (!targetUser || targetUser.tenantId !== tenantId) {
        return NextResponse.json({ error: "Usuario no disponible" }, { status: 404 })
      }

      data[k] = targetUser.id
      continue
    }
    if (DECIMAL_FIELDS.has(k)) {
      data[k] = toDecimal(v)
      continue
    }
    if (k === "date") {
      data[k] = v == null ? null : new Date(v as string | number)
      continue
    }
    data[k] = v ?? null
  }

  try {
    const updated = await prisma.sale.update({
      where: { id },
      data,
      include: { buyer: true, user: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } },
    })
    return NextResponse.json({ sale: updated })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error?.message ?? "PATCH failed" }, { status: 500 })
  }
}
