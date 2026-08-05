import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { assertCatalogProductType, quickCreateCatalogModel } from "@/lib/config/catalogService"

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const item = await quickCreateCatalogModel({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      type: assertCatalogProductType(body.type),
      name: String(body.name ?? ""),
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear modelo"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
