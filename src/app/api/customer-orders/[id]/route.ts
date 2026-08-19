import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getCustomerOrder, transitionCustomerOrder, type CustomerOrderStatus } from "@/lib/domain/customer-orders"

const statuses: CustomerOrderStatus[] = [
  "CONFIRMED",
  "PROCUREMENT_PENDING",
  "ORDERED_TO_SUPPLIER",
  "IN_TRANSIT",
  "RECEIVED",
  "READY_FOR_DELIVERY",
  "CANCELLED",
]

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await context.params
  const order = await getCustomerOrder(tenantId, id)
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await context.params

  try {
    const body = await request.json()
    const status = body?.status as CustomerOrderStatus
    if (!statuses.includes(status)) return NextResponse.json({ error: "Estado de pedido inválido" }, { status: 400 })
    const result = await transitionCustomerOrder({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      orderId: id,
      status,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el pedido" }, { status: 400 })
  }
}
