// app/api/products/route.ts
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const SELLABLE_STATES = ["EN_STOCK", "DISPONIBLE"] as const
const PRODUCT_STATES = [
  "EN_STOCK",
  "EN_CAMINO",
  "EN_REPARACION",
  "CON_CLIENTE",
  "DISPONIBLE",
  "FUERA_DE_STOCK",
  "RESERVADO",
  "VENDIDO",
] as const

function parseLimit(v: string | null) {
  const n = v ? Number(v) : DEFAULT_LIMIT
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

function parseOrderBy(v: string | null) {
  switch (v) {
    case "alpha_asc":
      return [{ modelName: "asc" as const }]
    case "alpha_desc":
      return [{ modelName: "desc" as const }]
    case "created_desc":
      return [{ createdAt: "desc" as const }, { id: "desc" as const }]
    case "created_asc":
      return [{ createdAt: "asc" as const }, { id: "asc" as const }]
    case "updated_desc":
      return [{ updatedAt: "desc" as const }, { id: "desc" as const }]
    case "updated_asc":
      return [{ updatedAt: "asc" as const }, { id: "asc" as const }]
    default:
      return [{ createdAt: "desc" as const }, { id: "desc" as const }]
  }
}

// Declare select shape as a const so `typeof PRODUCT_SELECT` is always
// structurally identical to what findMany receives. This prevents the
// implicit-any that arises when Prisma 7 fails to unify an inline literal
// type with the explicit GetPayload annotation.
const PRODUCT_SELECT = {
  id: true,
  tenantId: true,
  state: true,
  senado: true,
  senadoAt: true,
  status: true,
  type: true,
  brand: true,
  modelName: true,
  imei: true,
  capacityGB: true,
  condition: true,
  color: true,
  batteryPct: true,
  purchaseDate: true,
  location: true,
  origin: true,
  costPrice: true,
  salePrice: true,
  shippingCost: true,
  stockInitial: true,
  stock: true,
  stockAvailable: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>

/**
 * GET /api/products?state=EN_STOCK&type=PHONE&q=iPhone&limit=50&cursor=<productId>
 * Returns: { products: SerializedProduct[], nextCursor: string | null, totalProducts: number }
 */
export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)

    const tenantId = process.env.DEFAULT_TENANT_ID
    if (!tenantId) {
      return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })
    }

    const limit = parseLimit(searchParams.get("limit"))
    const cursor = searchParams.get("cursor")
    const orderParam = searchParams.get("orderBy")
    const orderBy = parseOrderBy(orderParam)

    const qRaw = searchParams.get("q")
    const q = qRaw?.trim() ? qRaw.trim() : null

    const stateParam = searchParams.get("state")
    const senadoParam = searchParams.get("senado")
    const sellableParam = searchParams.get("sellable")
    const typeParam = searchParams.get("type")

    const where: NonNullable<Parameters<typeof prisma.product.findMany>[0]>["where"] = { tenantId }

    if (sellableParam === "true") {
      where.state = { in: SELLABLE_STATES as unknown as string[] } as any
      where.senado = false
    } else if (stateParam && stateParam !== "TODOS" && PRODUCT_STATES.includes(stateParam as any)) {
      where.state = stateParam as any
    }
    if (senadoParam === "true") where.senado = true
    if (senadoParam === "false") where.senado = false
    if (typeParam) where.type = typeParam as any

    if (q) {
      where.OR = [
        { modelName: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { imei: { contains: q, mode: "insensitive" } },
      ]
    }

    // IMPORTANT: count must match same filters (where)
    const totalProducts = await prisma.product.count({ where })

    const rows: ProductRow[] = await prisma.product.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: PRODUCT_SELECT,
    })

    const hasNextPage = rows.length > limit
    const page: ProductRow[] = hasNextPage ? rows.slice(0, limit) : rows
    const nextCursor = hasNextPage ? page[page.length - 1]?.id ?? null : null

    const products = page.map((p: ProductRow) => ({
      id: p.id,
      tenantId: p.tenantId,

      type: p.type,
      state: p.state,
      senado: p.senado,
      senadoAt: p.senadoAt ? p.senadoAt.toISOString() : null,
      status: p.status, // don't coerce to string/defaults; keep enum value

      brand: p.brand ?? null,
      modelName: p.modelName,
      imei: p.imei ?? null,

      capacityGB: p.capacityGB ?? null,

      condition: p.condition ?? null,
      color: p.color ?? null,
      batteryPct: p.batteryPct ?? null,
      location: p.location ?? null,
      origin: p.origin ?? null,

      purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,

      costPrice: p.costPrice != null ? String(p.costPrice) : null,
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      shippingCost: p.shippingCost != null ? String(p.shippingCost) : null,

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
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const tenantId = body.tenantId ?? process.env.DEFAULT_TENANT_ID
    if (!tenantId) {
      return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })
    }

    if (body.senado === false) body.senadoAt = null
    if (body.senado === true && !body.senadoAt) body.senadoAt = new Date()

    const product = await prisma.product.create({
      data: { ...body, tenantId },
    })

    // Keep POST response consistent with your client shape if you want
    const serialized = {
      ...product,
      costPrice: product.costPrice != null ? String(product.costPrice) : null,
      salePrice: product.salePrice != null ? String(product.salePrice) : null,
      shippingCost: product.shippingCost != null ? String(product.shippingCost) : null,
      purchaseDate: product.purchaseDate ? product.purchaseDate.toISOString() : null,
      createdAt: product.createdAt ? product.createdAt.toISOString() : null,
      updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
    }

    return NextResponse.json(serialized, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error creando producto" }, { status: 500 })
  }
}
