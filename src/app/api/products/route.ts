// app/api/products/route.ts
import { prisma } from "@/lib/prisma"
import { ProductState, ProductType } from "@prisma/client"
import { NextResponse } from "next/server"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function parseLimit(v: string | null) {
  const n = v ? Number(v) : DEFAULT_LIMIT
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

function isEnumValue<T extends Record<string, string>>(enm: T, v: string | null): v is T[keyof T] {
  return !!v && Object.values(enm).includes(v as any)
}

/**
 * GET /api/products?state=EN_STOCK&type=PHONE&q=iPhone&limit=50&cursor=<productId>
 *
 * Returns:
 * { products: SerializedProduct[], nextCursor: string | null }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const tenantId = process.env.DEFAULT_TENANT_ID
    if (!tenantId) {
      return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })
    }

    const limit = parseLimit(searchParams.get("limit"))
    const cursor = searchParams.get("cursor")

    const qRaw = searchParams.get("q")
    const q = qRaw?.trim() ? qRaw.trim() : null

    const stateParam = searchParams.get("state")
    const typeParam = searchParams.get("type")

    const where: NonNullable<Parameters<typeof prisma.product.findMany>[0]>["where"] = { tenantId }

    if (isEnumValue(ProductState, stateParam)) where.state = stateParam as ProductState
    if (isEnumValue(ProductType, typeParam)) where.type = typeParam as ProductType

    if (q) {
      where.OR = [
        { modelName: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { imei: { contains: q, mode: "insensitive" } },
      ]
    }

    const totalProducts = await prisma.product.count()

    // Cursor pagination note:
    // Prisma requires that `cursor` matches the `orderBy` uniqueness for strict stability.
    // Here we keep cursor by `id` and a stable orderBy including `id`.
    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        tenantId: true,
        state: true,
        type: true,
        brand: true,
        modelName: true,
        imei: true,
        condition: true,
        color: true,
        batteryPct: true,
        purchaseDate: true,
        costPrice: true,
        salePrice: true,
        shippingCost: true,
        status: true, // include if your SerializedProduct expects it
        stockInitial: true,
        stock: true,
        stockAvailable: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const hasNextPage = rows.length > limit
    const page = hasNextPage ? rows.slice(0, limit) : rows
    const nextCursor = hasNextPage ? page[page.length - 1]?.id ?? null : null

    // Serialize to match your Client type:
    // - Decimal -> string
    // - Date -> ISO string
    // - keep nulls as null (don't replace with "" unless you really want that)
    const products = page.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      type: p.type,
      brand: p.brand ?? null,
      imei: p.imei ?? null,
      modelName: p.modelName,
      capacityGB: null as number | null, // remove this line if capacityGB exists in your schema
      condition: p.condition ?? null,
      color: p.color ?? null,
      batteryPct: p.batteryPct ?? null,
      purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,
      costPrice: p.costPrice != null ? String(p.costPrice) : null,
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      shippingCost: p.shippingCost != null ? String(p.shippingCost) : null,
      state: p.state,
      status: p.status ?? "ACTIVE", // adapt to your schema (or just `p.status`)
      stockInitial: p.stockInitial ?? 0,
      stock: p.stock ?? 0,
      stockAvailable: p.stockAvailable ?? 0,
      notes: p.notes ?? null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    }))

    return NextResponse.json({ products, nextCursor, totalProducts }, { status: 200 })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tenantId = body.tenantId ?? process.env.DEFAULT_TENANT_ID
    if (!tenantId) {
      return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })
    }

    const product = await prisma.product.create({
      data: { ...body, tenantId },
    })

    // Keep POST response consistent with your client shape if you want
    const serialized = {
      ...product,
      costPrice: (product as any).costPrice != null ? String((product as any).costPrice) : null,
      salePrice: (product as any).salePrice != null ? String((product as any).salePrice) : null,
      shippingCost: (product as any).shippingCost != null ? String((product as any).shippingCost) : null,
      purchaseDate: (product as any).purchaseDate ? new Date((product as any).purchaseDate).toISOString() : null,
      createdAt: (product as any).createdAt ? new Date((product as any).createdAt).toISOString() : null,
      updatedAt: (product as any).updatedAt ? new Date((product as any).updatedAt).toISOString() : null,
    }

    return NextResponse.json(serialized, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error creando producto" }, { status: 500 })
  }
}
