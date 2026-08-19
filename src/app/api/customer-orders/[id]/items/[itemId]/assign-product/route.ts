import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { assignOrderItemProduct } from "@/lib/domain/customer-orders"

export async function POST(request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id, itemId } = await context.params

  try {
    const body = await request.json()
    if (!body?.productId) throw new Error("productId es obligatorio.")
    const result = await assignOrderItemProduct({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      orderId: id,
      itemId,
      productId: String(body.productId),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo asignar el producto" }, { status: 400 })
  }
}
