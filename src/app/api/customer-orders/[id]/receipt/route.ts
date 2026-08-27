import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getCustomerOrder } from "@/lib/domain/customer-orders"
import { renderCustomerOrderReceiptHtml } from "@/lib/customer-orders/receipt"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await context.params
  const order = await getCustomerOrder(tenantId, id)
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })

  return new Response(renderCustomerOrderReceiptHtml(order), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  })
}
