import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getCustomerOrderSettings, updateCustomerOrderSettings } from "@/lib/domain/customer-orders"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  return NextResponse.json(await getCustomerOrderSettings(tenantId))
}

export async function PUT(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const body = await request.json()
    const result = await updateCustomerOrderSettings({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      minimumDepositUsd: new Prisma.Decimal(body?.minimumDepositUsd ?? 100),
      defaultDeliveryDays: Number(body?.defaultDeliveryDays ?? 7),
      deliveryDisclaimer: String(body?.deliveryDisclaimer ?? "").trim(),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la configuración" }, { status: 400 })
  }
}
