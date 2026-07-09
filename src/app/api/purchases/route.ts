import { NextResponse } from "next/server"
import { ProductType, UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { createPurchaseWithPayments, listPurchases, purchaseSchema } from "@/lib/domain/purchases"

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const rawType = searchParams.get("type")
  const type = rawType === ProductType.PHONE || rawType === ProductType.ACCESSORY ? rawType : null
  const purchases = await listPurchases({
    tenantId,
    q: searchParams.get("q"),
    type,
  })
  return NextResponse.json({ purchases })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = purchaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const result = await createPurchaseWithPayments({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      actorRealRole: auth.session.user.role as UserRole,
      input: parsed.data,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando compra"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
