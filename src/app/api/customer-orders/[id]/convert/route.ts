import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { convertCustomerOrderToSale } from "@/lib/domain/customer-orders"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await context.params

  try {
    const result = await convertCustomerOrderToSale({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      orderId: id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo convertir el pedido" }, { status: 400 })
  }
}
