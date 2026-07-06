import { NextRequest, NextResponse } from "next/server"
import { ServiceOrderStatus, UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { transitionServiceOrder } from "@/lib/domain/service-orders"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = body?.status as ServiceOrderStatus | undefined
  if (!status || !Object.values(ServiceOrderStatus).includes(status)) return NextResponse.json({ error: "Estado invalido" }, { status: 400 })
  try {
    const order = await transitionServiceOrder({
      tenantId,
      orderId: id,
      status,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
    })
    return NextResponse.json({ order })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error cambiando estado"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 400 })
  }
}
