import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { quickCreateCatalogCapacity } from "@/lib/config/catalogService"

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const item = await quickCreateCatalogCapacity({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      capacityGB: Number(body.capacityGB),
      label: typeof body.label === "string" ? body.label : null,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear capacidad"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
