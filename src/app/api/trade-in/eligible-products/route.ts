import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getTenantId, TRADE_IN_ALLOWED_STATES } from "../_utils"

const PRODUCT_SELECT = {
  id: true,
  modelName: true,
  capacityGB: true,
  batteryPct: true,
  color: true,
  imei: true,
  state: true,
  senado: true,
  salePrice: true,
  location: true,
  condition: true,
} as const

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const stateParam = searchParams.get("state") ?? "EN_STOCK"
  const state = TRADE_IN_ALLOWED_STATES.includes(stateParam as any) ? stateParam : "EN_STOCK"
  const includeReserved = searchParams.get("includeReserved") === "true"

  const where: Prisma.ProductWhereInput = {
    tenantId,
    type: "PHONE",
    state: state as any,
    ...(includeReserved ? {} : { senado: false }),
  }

  if (q) {
    where.OR = [
      { modelName: { contains: q, mode: "insensitive" } },
      { imei: { contains: q, mode: "insensitive" } },
      { color: { contains: q, mode: "insensitive" } },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    select: PRODUCT_SELECT,
    orderBy: [{ senado: "asc" }, { modelName: "asc" }, { capacityGB: "asc" }],
    take: 25,
  })

  return NextResponse.json({
    products: products.map((product) => ({
      ...product,
      salePrice: String(product.salePrice),
    })),
  })
}
